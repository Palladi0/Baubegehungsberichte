import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

export interface MigrationCheckResult {
  credentialsValid: boolean | null
  phoneNumberRegistered: boolean | null
  templateApproved: boolean | null
  errors: Record<string, string>
}

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const accountSid = process.env.TWILIO_PRODUCTION_ACCOUNT_SID
  const authToken = process.env.TWILIO_PRODUCTION_AUTH_TOKEN
  const phoneNumber = process.env.TWILIO_PRODUCTION_PHONE_NUMBER

  const result: MigrationCheckResult = {
    credentialsValid: null,
    phoneNumberRegistered: null,
    templateApproved: null,
    errors: {},
  }

  if (!accountSid || !authToken) {
    result.credentialsValid = false
    result.errors.credentials = 'TWILIO_PRODUCTION_ACCOUNT_SID oder TWILIO_PRODUCTION_AUTH_TOKEN fehlt'
    return NextResponse.json(result)
  }

  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
  const headers = { Authorization: `Basic ${credentials}` }

  // 1. Credentials gültig? → GET /Accounts/{SID}
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, { headers })
    result.credentialsValid = res.ok
    if (!res.ok) {
      result.errors.credentials = `Twilio antwortete mit HTTP ${res.status}`
    }
  } catch {
    result.credentialsValid = false
    result.errors.credentials = 'Verbindung zu Twilio fehlgeschlagen'
  }

  // 2. Büronummer registriert? → GET /IncomingPhoneNumbers
  if (phoneNumber) {
    try {
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(phoneNumber)}`,
        { headers }
      )
      if (res.ok) {
        const json = await res.json() as { incoming_phone_numbers?: unknown[] }
        result.phoneNumberRegistered = (json.incoming_phone_numbers?.length ?? 0) > 0
        if (!result.phoneNumberRegistered) {
          result.errors.phone = `${phoneNumber} ist nicht als Twilio-Nummer registriert`
        }
      } else {
        result.phoneNumberRegistered = false
        result.errors.phone = `Twilio antwortete mit HTTP ${res.status}`
      }
    } catch {
      result.phoneNumberRegistered = false
      result.errors.phone = 'Verbindung zu Twilio fehlgeschlagen'
    }
  } else {
    result.phoneNumberRegistered = false
    result.errors.phone = 'TWILIO_PRODUCTION_PHONE_NUMBER nicht konfiguriert'
  }

  // 3. Mindestens 1 Template mit Status APPROVED?
  try {
    const db = createServiceClient()
    const { data: templateRows } = await db
      .from('system_config')
      .select('value')
      .in('key', ['whatsapp_template_sid_bestaetigung', 'whatsapp_template_sid_unbekannt'])

    const configuredSids = (templateRows ?? []).map((r) => r.value).filter(Boolean)

    if (configuredSids.length === 0) {
      result.templateApproved = false
      result.errors.template = 'Keine Template-SIDs in system_config konfiguriert'
    } else {
      const res = await fetch(
        `https://content.twilio.com/v1/ContentAndApprovals?PageSize=50`,
        { headers: { ...headers, 'Content-Type': 'application/json' } }
      )
      if (res.ok) {
        const json = await res.json() as {
          contents?: Array<{ sid: string; approval_requests?: { status: string } }>
        }
        const approvedSids = new Set(
          (json.contents ?? [])
            .filter((t) => t.approval_requests?.status === 'APPROVED')
            .map((t) => t.sid)
        )
        const hasApproved = configuredSids.some((sid) => approvedSids.has(sid))
        result.templateApproved = hasApproved
        if (!hasApproved) {
          result.errors.template = 'Keines der konfigurierten Templates hat Status APPROVED'
        }
      } else {
        result.templateApproved = false
        result.errors.template = `Twilio Content API antwortete mit HTTP ${res.status}`
      }
    }
  } catch {
    result.templateApproved = false
    result.errors.template = 'Template-Prüfung fehlgeschlagen'
  }

  return NextResponse.json(result)
}
