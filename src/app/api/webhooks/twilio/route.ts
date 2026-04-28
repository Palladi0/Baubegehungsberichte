import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-service'
import { validateTwilioSignature, twimlResponse } from '@/lib/twilio'
import { hasPendingClarification, resolveWithClarification, extractHashtags } from '@/lib/assignment-worker'

export const dynamic = 'force-dynamic'

type MessageType = 'text' | 'audio' | 'foto'

function detectMessageType(contentType: string | undefined): MessageType {
  if (!contentType) return 'text'
  if (contentType.startsWith('audio/') || contentType.startsWith('video/')) return 'audio'
  if (contentType.startsWith('image/')) return 'foto'
  return 'text'
}

export async function POST(request: NextRequest) {
  // Twilio webhook URL muss exakt übereinstimmen (inkl. Protokoll + Host)
  const webhookUrl =
    process.env.TWILIO_WEBHOOK_URL ??
    `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio`

  const signature = request.headers.get('x-twilio-signature') ?? ''

  // Form-Body als Objekt einlesen
  const formData = await request.formData()
  const params: Record<string, string> = {}
  formData.forEach((value, key) => {
    params[key] = value.toString()
  })

  // 1. Signatur-Validierung (HMAC-SHA1)
  if (!validateTwilioSignature(signature, webhookUrl, params)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const messageSid = params['MessageSid']
  const from = params['From'] ?? ''
  const body = params['Body'] ?? ''
  const numMedia = parseInt(params['NumMedia'] ?? '0', 10)
  const mediaUrl = numMedia > 0 ? params['MediaUrl0'] : null
  const mediaContentType = numMedia > 0 ? params['MediaContentType0'] : null

  if (!messageSid) {
    return new NextResponse('Bad Request', { status: 400 })
  }

  // Twilio sendet "whatsapp:+49..." — Präfix entfernen
  const senderPhone = from.replace(/^whatsapp:/, '')

  const db = createServiceClient()

  // 2. Idempotenz-Check: Twilio kann denselben Webhook mehrfach senden
  const { data: existing } = await db
    .from('incoming_messages')
    .select('id')
    .eq('twilio_message_sid', messageSid)
    .maybeSingle()

  if (existing) {
    return new NextResponse(twimlResponse(''), {
      headers: { 'Content-Type': 'text/xml' },
    })
  }

  // 3. Absender-Lookup: Telefonnummer → Mitarbeiter-Account
  const { data: registration } = await db
    .from('phone_registrations')
    .select('user_id')
    .eq('phone_number', senderPhone)
    .eq('is_active', true)
    .maybeSingle()

  // 3b. ClarificationCheck: Offene Klärungsanfrage für diesen Absender (< 30 Min)?
  if (body && (await hasPendingClarification(senderPhone))) {
    const handled = await resolveWithClarification(senderPhone, body)
    if (handled) {
      return new NextResponse(twimlResponse(''), {
        headers: { 'Content-Type': 'text/xml' },
      })
    }
  }

  const messageType = detectMessageType(mediaContentType ?? undefined)

  // 4. Nachricht loggen
  const { data: message, error: insertError } = await db
    .from('incoming_messages')
    .insert({
      twilio_message_sid: messageSid,
      sender_phone: senderPhone,
      user_id: registration?.user_id ?? null,
      message_type: messageType,
      text_content: body || null,
      twilio_media_url: mediaUrl,
      status: numMedia > 0 ? 'received' : 'stored',
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('[twilio-webhook] DB insert error:', insertError.message)
    // Twilio soll es später erneut versuchen
    return new NextResponse('Internal Server Error', { status: 500 })
  }

  // 5. Jobs einreihen (asynchron, außerhalb des Webhook-Timeouts verarbeitet)
  if (numMedia > 0 && message) {
    // Medien-Download zuerst — der Media Worker legt danach den Assignment-Job an
    await db.from('media_jobs').insert({ incoming_message_id: message.id })
  } else if (message) {
    // Reine Text-Nachrichten: direkt Zuordnungs-Job anlegen
    await db.from('assignment_jobs').insert({ incoming_message_id: message.id })
  }

  // 6. Automatische WhatsApp-Antwort (Modus-abhängig)
  const { data: modeRow } = await db
    .from('system_config')
    .select('value')
    .eq('key', 'whatsapp_mode')
    .maybeSingle()

  const isProduction = modeRow?.value === 'production'

  if (isProduction) {
    // Produktions-Modus: Meta-genehmigte Templates via Twilio Content API
    const { data: templateRow } = await db
      .from('system_config')
      .select('value')
      .eq('key', registration ? 'whatsapp_template_sid_bestaetigung' : 'whatsapp_template_sid_unbekannt')
      .maybeSingle()

    const templateSid = templateRow?.value
    if (templateSid) {
      try {
        const twilio = await import('twilio')
        const prodSid = process.env.TWILIO_PRODUCTION_ACCOUNT_SID ?? process.env.TWILIO_ACCOUNT_SID!
        const prodToken = process.env.TWILIO_PRODUCTION_AUTH_TOKEN ?? process.env.TWILIO_AUTH_TOKEN!
        const prodNumber = process.env.TWILIO_PRODUCTION_PHONE_NUMBER ?? process.env.TWILIO_PHONE_NUMBER!
        const client = twilio.default(prodSid, prodToken)

        // Projektkürzel aus dem Nachrichtentext extrahieren (Assignment-Worker läuft noch nicht).
        // Erster Hashtag aus body wird als Template-Variable verwendet.
        const hashtags = body ? extractHashtags(body) : []
        const variables = registration
          ? { 1: hashtags[0] ?? 'unbekannt' }
          : {}

        await client.messages.create({
          from: `whatsapp:${prodNumber}`,
          to: from,
          contentSid: templateSid,
          contentVariables: JSON.stringify(variables),
        })
      } catch (err) {
        console.error('[twilio-webhook] Template-Versand fehlgeschlagen:', err)
      }
      return new NextResponse(twimlResponse(''), {
        headers: { 'Content-Type': 'text/xml' },
      })
    }
  }

  // Sandbox-Modus (oder Produktions-Fallback wenn kein Template konfiguriert): Freitext
  const reply = registration
    ? '✓ Nachricht empfangen. Verarbeitung läuft...'
    : 'Ihre Nummer ist nicht im System registriert. Bitte wenden Sie sich an den Administrator.'

  return new NextResponse(twimlResponse(reply), {
    headers: { 'Content-Type': 'text/xml' },
  })
}
