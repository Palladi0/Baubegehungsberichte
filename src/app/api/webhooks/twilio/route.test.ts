import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// --- Mocks ---

const mockMaybeSingle = vi.fn()
const mockInsertSelect = vi.fn()
const mockInsert = vi.fn(() => ({ select: () => ({ single: mockInsertSelect }) }))
const mockMediaInsert = vi.fn(() => ({}))
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
  return {}
})

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}))

vi.mock('@/lib/twilio', () => ({
  validateTwilioSignature: vi.fn(),
  twimlResponse: (msg: string) => `<Response><Message>${msg}</Message></Response>`,
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
})
