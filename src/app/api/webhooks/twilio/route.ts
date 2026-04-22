import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { validateTwilioSignature, twimlResponse } from '@/lib/twilio'

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

  // 5. Medien-Job einreihen (asynchron, außerhalb des Webhook-Timeouts verarbeitet)
  if (numMedia > 0 && message) {
    await db.from('media_jobs').insert({ incoming_message_id: message.id })
  }

  // 6. Automatische WhatsApp-Antwort
  const reply = registration
    ? '✓ Nachricht empfangen. Verarbeitung läuft...'
    : 'Ihre Nummer ist nicht im System registriert. Bitte wenden Sie sich an den Administrator.'

  return new NextResponse(twimlResponse(reply), {
    headers: { 'Content-Type': 'text/xml' },
  })
}
