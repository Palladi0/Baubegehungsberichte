import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// --- Mocks ---

const mockMaybeSingle = vi.fn()
const mockInsertSelect = vi.fn()
const mockInsert = vi.fn(() => ({ select: () => ({ single: mockInsertSelect }) }))
const mockMediaInsert = vi.fn(() => ({}))
const mockNoopInsert = vi.fn().mockResolvedValue({})
const mockSystemConfigSelect = () => ({
  select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }) }),
})
const mockFrom = vi.fn((table: string) => {
  if (table === 'incoming_messages') {
    return {
      select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }),
      insert: mockInsert,
    }
  }
  if (table === 'phone_registrations') {
    return {
      select: () => ({
        eq: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }) }),
      }),
    }
  }
  if (table === 'media_jobs') {
    return { insert: mockMediaInsert }
  }
  if (table === 'assignment_jobs') {
    return { insert: mockNoopInsert }
  }
  if (table === 'system_config') {
    return mockSystemConfigSelect()
  }
  return {}
})

vi.mock('@/lib/supabase-service', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}))

vi.mock('@/lib/twilio', () => ({
  validateTwilioSignature: vi.fn(),
  twimlResponse: (msg: string) => `<Response><Message>${msg}</Message></Response>`,
}))

vi.mock('@/lib/assignment-worker', () => ({
  hasPendingClarification: vi.fn().mockResolvedValue(false),
  resolveWithClarification: vi.fn().mockResolvedValue(false),
}))

import { validateTwilioSignature } from '@/lib/twilio'
import { POST } from './route'

const validParams = {
  MessageSid: 'SM123456',
  From: 'whatsapp:+4917612345678',
  Body: 'Testmeldung',
  NumMedia: '0',
}

function makeRequest(params: Record<string, string> = validParams) {
  const body = new URLSearchParams(params)
  return new NextRequest('http://localhost/api/webhooks/twilio', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'x-twilio-signature': 'valid-sig',
    },
    body: body.toString(),
  })
}

function setupDefaultMocks() {
  mockMaybeSingle.mockResolvedValue({ data: null })
  mockInsertSelect.mockResolvedValue({ data: { id: 'msg-uuid-1' }, error: null })
  mockInsert.mockReturnValue({ select: () => ({ single: mockInsertSelect }) })
  mockMediaInsert.mockResolvedValue({})
  mockNoopInsert.mockResolvedValue({})
  mockFrom.mockImplementation((table: string) => {
    if (table === 'incoming_messages') {
      return {
        select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }),
        insert: mockInsert,
      }
    }
    if (table === 'phone_registrations') {
      return {
        select: () => ({
          eq: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }) }),
        }),
      }
    }
    if (table === 'media_jobs') {
      return { insert: mockMediaInsert }
    }
    if (table === 'assignment_jobs') {
      return { insert: mockNoopInsert }
    }
    if (table === 'system_config') {
      return { select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }) }) }
    }
    return {}
  })
}

describe('POST /api/webhooks/twilio', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    setupDefaultMocks()
  })

  it('gibt 403 zurück bei ungültiger Twilio-Signatur', async () => {
    vi.mocked(validateTwilioSignature).mockReturnValue(false)

    const res = await POST(makeRequest())
    expect(res.status).toBe(403)
  })

  it('gibt 200 + leere TwiML zurück bei Duplikat (idempotenz)', async () => {
    vi.mocked(validateTwilioSignature).mockReturnValue(true)
    mockMaybeSingle.mockResolvedValue({ data: { id: 'existing-id' } })

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain('Response')
  })

  it('verarbeitet Text-Nachricht von bekanntem Absender', async () => {
    vi.mocked(validateTwilioSignature).mockReturnValue(true)

    // phone_registrations gibt einen Nutzer zurück
    mockFrom.mockImplementation((table: string) => {
      if (table === 'incoming_messages') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }) }),
          insert: vi.fn(() => ({
            select: () => ({ single: vi.fn().mockResolvedValue({ data: { id: 'msg-1' }, error: null }) }),
          })),
        }
      }
      if (table === 'phone_registrations') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: { user_id: 'user-uuid-1' } }),
              }),
            }),
          }),
        }
      }
      if (table === 'media_jobs') {
        return { insert: vi.fn().mockResolvedValue({}) }
      }
      if (table === 'assignment_jobs') {
        return { insert: vi.fn().mockResolvedValue({}) }
      }
      if (table === 'system_config') {
        return { select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }) }) }
      }
      return {}
    })

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain('✓ Nachricht empfangen')
  })

  it('antwortet mit Fehlertext bei unbekanntem Absender', async () => {
    vi.mocked(validateTwilioSignature).mockReturnValue(true)
    // phone_registrations bleibt null (Standard-Mock)

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain('nicht im System registriert')
  })

  it('reiht Medien-Job ein bei Fotos', async () => {
    vi.mocked(validateTwilioSignature).mockReturnValue(true)

    const mediaInsertSpy = vi.fn().mockResolvedValue({})
    mockFrom.mockImplementation((table: string) => {
      if (table === 'incoming_messages') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }) }),
          insert: vi.fn(() => ({
            select: () => ({
              single: vi.fn().mockResolvedValue({ data: { id: 'msg-foto-1' }, error: null }),
            }),
          })),
        }
      }
      if (table === 'phone_registrations') {
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }) }),
          }),
        }
      }
      if (table === 'media_jobs') {
        return { insert: mediaInsertSpy }
      }
      if (table === 'assignment_jobs') {
        return { insert: vi.fn().mockResolvedValue({}) }
      }
      if (table === 'system_config') {
        return { select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }) }) }
      }
      return {}
    })

    const params = {
      ...validParams,
      NumMedia: '1',
      MediaUrl0: 'https://api.twilio.com/media/IMG.jpg',
      MediaContentType0: 'image/jpeg',
    }
    await POST(makeRequest(params))
    expect(mediaInsertSpy).toHaveBeenCalledWith({ incoming_message_id: 'msg-foto-1' })
  })

  it('verarbeitet Klärungsantwort wenn offene Klärung vorhanden (ClarificationCheck)', async () => {
    const { hasPendingClarification, resolveWithClarification } = await import('@/lib/assignment-worker')
    vi.mocked(validateTwilioSignature).mockReturnValue(true)
    vi.mocked(hasPendingClarification).mockResolvedValue(true)
    vi.mocked(resolveWithClarification).mockResolvedValue(true)

    const res = await POST(makeRequest({ ...validParams, Body: 'BV-23-Hamburg' }))
    expect(res.status).toBe(200)
    expect(resolveWithClarification).toHaveBeenCalledWith('+4917612345678', 'BV-23-Hamburg')
  })

  it('läuft normaler Fluss wenn Klärungsantwort nicht verarbeitet werden konnte', async () => {
    const { hasPendingClarification, resolveWithClarification } = await import('@/lib/assignment-worker')
    vi.mocked(validateTwilioSignature).mockReturnValue(true)
    vi.mocked(hasPendingClarification).mockResolvedValue(true)
    vi.mocked(resolveWithClarification).mockResolvedValue(false)

    const res = await POST(makeRequest())
    // normaler Fluss: Nachricht wird gespeichert
    expect(res.status).toBe(200)
  })

  it('legt Zuordnungs-Job für Text-Nachrichten direkt im Webhook an', async () => {
    vi.mocked(validateTwilioSignature).mockReturnValue(true)

    const assignmentInsertSpy = vi.fn().mockResolvedValue({})
    mockFrom.mockImplementation((table: string) => {
      if (table === 'incoming_messages') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }) }),
          insert: vi.fn(() => ({
            select: () => ({ single: vi.fn().mockResolvedValue({ data: { id: 'msg-text-1' }, error: null }) }),
          })),
        }
      }
      if (table === 'phone_registrations') {
        return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }) }) }) }
      }
      if (table === 'media_jobs') {
        return { insert: vi.fn().mockResolvedValue({}) }
      }
      if (table === 'assignment_jobs') {
        return { insert: assignmentInsertSpy }
      }
      if (table === 'system_config') {
        return { select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }) }) }
      }
      return {}
    })

    await POST(makeRequest({ ...validParams, NumMedia: '0' }))
    expect(assignmentInsertSpy).toHaveBeenCalledWith({ incoming_message_id: 'msg-text-1' })
  })

  // ── PROJ-11: Produktions-Modus ─────────────────────────────────────────────

  it('sendet Freitext wenn Modus = sandbox (Standard)', async () => {
    vi.mocked(validateTwilioSignature).mockReturnValue(true)
    // system_config gibt sandbox-Modus zurück (kein value → null → Sandbox)
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain('Ihre Nummer ist nicht im System registriert')
  })

  it('fällt auf Freitext zurück wenn Modus = production aber kein Template-SID konfiguriert', async () => {
    vi.mocked(validateTwilioSignature).mockReturnValue(true)

    mockFrom.mockImplementation((table: string) => {
      if (table === 'incoming_messages') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }) }),
          insert: vi.fn(() => ({
            select: () => ({ single: vi.fn().mockResolvedValue({ data: { id: 'msg-prod-1' }, error: null }) }),
          })),
        }
      }
      if (table === 'phone_registrations') {
        return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }) }) }) }
      }
      if (table === 'media_jobs') { return { insert: vi.fn().mockResolvedValue({}) } }
      if (table === 'assignment_jobs') { return { insert: vi.fn().mockResolvedValue({}) } }
      if (table === 'system_config') {
        return {
          select: () => ({
            eq: (col: string, val: string) => ({
              maybeSingle: vi.fn().mockResolvedValue({
                // whatsapp_mode = production, aber kein Template-SID
                data: val === 'whatsapp_mode' ? { value: 'production' } : null,
              }),
            }),
          }),
        }
      }
      return {}
    })

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    // Kein templateSid → Freitext-Fallback
    const text = await res.text()
    expect(text).toContain('nicht im System registriert')
  })

  it('sendet Template-Nachricht im Produktions-Modus mit konfiguriertem SID', async () => {
    vi.mocked(validateTwilioSignature).mockReturnValue(true)

    const mockCreate = vi.fn().mockResolvedValue({ sid: 'SM_template_1' })
    vi.mock('twilio', () => ({
      default: vi.fn(() => ({
        messages: { create: mockCreate },
      })),
    }))

    process.env.TWILIO_PRODUCTION_ACCOUNT_SID = 'ACprod'
    process.env.TWILIO_PRODUCTION_AUTH_TOKEN = 'prodtoken'
    process.env.TWILIO_PRODUCTION_PHONE_NUMBER = '+4989123456'

    mockFrom.mockImplementation((table: string) => {
      if (table === 'incoming_messages') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }) }),
          insert: vi.fn(() => ({
            select: () => ({ single: vi.fn().mockResolvedValue({ data: { id: 'msg-tpl-1' }, error: null }) }),
          })),
        }
      }
      if (table === 'phone_registrations') {
        // Bekannter Absender
        return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { user_id: 'user-1' } }) }) }) }) }
      }
      if (table === 'media_jobs') { return { insert: vi.fn().mockResolvedValue({}) } }
      if (table === 'assignment_jobs') { return { insert: vi.fn().mockResolvedValue({}) } }
      if (table === 'system_config') {
        return {
          select: () => ({
            eq: (_col: string, val: string) => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: val === 'whatsapp_mode'
                  ? { value: 'production' }
                  : { value: 'HXbestaetigung' },
              }),
            }),
          }),
        }
      }
      return {}
    })

    const res = await POST(makeRequest({ ...validParams, Body: '#BV-23-Hamburg Begehung fertig' }))
    expect(res.status).toBe(200)
    // Im production-Modus mit Template → leere TwiML (Template wird via API gesendet)
    const text = await res.text()
    expect(text).toBe('<Response><Message></Message></Response>')
  })
})
