import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export interface TwilioTemplate {
  sid: string
  friendlyName: string
  variables: Record<string, string>
  whatsappApprovalStatus: string
  category: string
}

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const accountSid = process.env.TWILIO_PRODUCTION_ACCOUNT_SID ?? process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_PRODUCTION_AUTH_TOKEN ?? process.env.TWILIO_AUTH_TOKEN

  if (!accountSid || !authToken) {
    return NextResponse.json({ error: 'Twilio-Credentials nicht konfiguriert' }, { status: 500 })
  }

  try {
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
    const response = await fetch(
      `https://content.twilio.com/v1/ContentAndApprovals?PageSize=50`,
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      const text = await response.text()
      console.error('[templates] Twilio API error:', response.status, text)
      return NextResponse.json(
        { error: `Twilio API Fehler: ${response.status}` },
        { status: response.status }
      )
    }

    const json = await response.json() as {
      contents?: Array<{
        sid: string
        friendly_name: string
        variables?: Record<string, string>
        approval_requests?: {
          status: string
          category?: string
        }
      }>
    }

    const templates: TwilioTemplate[] = (json.contents ?? []).map((t) => ({
      sid: t.sid,
      friendlyName: t.friendly_name,
      variables: t.variables ?? {},
      whatsappApprovalStatus: t.approval_requests?.status ?? 'UNKNOWN',
      category: t.approval_requests?.category ?? '',
    }))

    return NextResponse.json(templates)
  } catch (err) {
    console.error('[templates] fetch error:', err)
    return NextResponse.json({ error: 'Verbindung zu Twilio fehlgeschlagen' }, { status: 502 })
  }
}
