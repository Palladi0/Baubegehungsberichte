import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks ---

vi.mock('@/lib/auth', () => ({
  requireAdmin: vi.fn(),
}))

const mockSelect = vi.fn()
const mockFrom = vi.fn(() => ({
  select: mockSelect,
}))

vi.mock('@/lib/supabase-service', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}))

import { requireAdmin } from '@/lib/auth'
import { GET } from './route'

const adminAuth = { ok: true as const, userId: 'admin-uuid', email: 'admin@test.de', role: 'admin' }
const unauthResult = { ok: false as const, error: 'Nicht authentifiziert', status: 401 as const }

function mockTwilioAccountOk() {
  return vi.fn().mockResolvedValue({ ok: true })
}

function mockTwilioPhoneNumberFound(phoneNumber: string) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ incoming_phone_numbers: [{ phone_number: phoneNumber }] }),
  })
}

function mockTwilioContentApproved(sid: string) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      contents: [{ sid, approval_requests: { status: 'APPROVED' } }],
    }),
  })
}

describe('GET /api/admin/whatsapp/migration-checks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TWILIO_PRODUCTION_ACCOUNT_SID = 'ACprod123'
    process.env.TWILIO_PRODUCTION_AUTH_TOKEN = 'prodtoken456'
    process.env.TWILIO_PRODUCTION_PHONE_NUMBER = '+4989123456'
  })

  it('gibt 401 zurück ohne Admin-Auth', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(unauthResult)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('gibt credentialsValid = false zurück wenn Env-Variablen fehlen', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    delete process.env.TWILIO_PRODUCTION_ACCOUNT_SID
    delete process.env.TWILIO_PRODUCTION_AUTH_TOKEN

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.credentialsValid).toBe(false)
    expect(json.errors.credentials).toContain('fehlt')
  })

  it('gibt credentialsValid = false wenn Twilio API Fehler zurückgibt', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
    // Supabase gibt leere Template-SID-Liste zurück
    mockSelect.mockReturnValue({
      in: () => ({ data: [], error: null }),
    })

    const res = await GET()
    const json = await res.json()
    expect(json.credentialsValid).toBe(false)
    expect(json.errors.credentials).toContain('401')
  })

  it('gibt credentialsValid = false bei Netzwerkfehler', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
    mockSelect.mockReturnValue({
      in: () => ({ data: [], error: null }),
    })

    const res = await GET()
    const json = await res.json()
    expect(json.credentialsValid).toBe(false)
    expect(json.errors.credentials).toBe('Verbindung zu Twilio fehlgeschlagen')
  })

  it('gibt phoneNumberRegistered = false wenn PHONE_NUMBER Env-Variable fehlt', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    delete process.env.TWILIO_PRODUCTION_PHONE_NUMBER

    // Nur Account-Endpunkt wird gerufen (kein Phone-Endpunkt), dann template check
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true }) // credentials OK
    vi.stubGlobal('fetch', fetchMock)
    mockSelect.mockReturnValue({
      in: () => ({ data: [], error: null }),
    })

    const res = await GET()
    const json = await res.json()
    expect(json.phoneNumberRegistered).toBe(false)
    expect(json.errors.phone).toContain('TWILIO_PRODUCTION_PHONE_NUMBER')
  })

  it('gibt phoneNumberRegistered = false wenn Nummer nicht in Twilio registriert', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true }) // credentials OK
      .mockResolvedValueOnce({             // phone lookup: keine Treffer
        ok: true,
        json: async () => ({ incoming_phone_numbers: [] }),
      })
    vi.stubGlobal('fetch', fetchMock)
    mockSelect.mockReturnValue({
      in: () => ({ data: [], error: null }),
    })

    const res = await GET()
    const json = await res.json()
    expect(json.phoneNumberRegistered).toBe(false)
    expect(json.errors.phone).toContain('+4989123456')
  })

  it('gibt templateApproved = false wenn keine SIDs in system_config konfiguriert', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true }) // credentials OK
      .mockResolvedValueOnce({             // phone lookup: gefunden
        ok: true,
        json: async () => ({ incoming_phone_numbers: [{ phone_number: '+4989123456' }] }),
      })
    vi.stubGlobal('fetch', fetchMock)

    // Keine Template-SIDs in DB
    mockSelect.mockReturnValue({
      in: () => ({ data: [], error: null }),
    })

    const res = await GET()
    const json = await res.json()
    expect(json.templateApproved).toBe(false)
    expect(json.errors.template).toContain('Template-SIDs')
  })

  it('alle Prüfungen bestehen — vollständiges Produktions-Szenario', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true }) // credentials OK
      .mockResolvedValueOnce({             // phone: gefunden
        ok: true,
        json: async () => ({ incoming_phone_numbers: [{ phone_number: '+4989123456' }] }),
      })
      .mockResolvedValueOnce({             // templates: HXabc123 APPROVED
        ok: true,
        json: async () => ({
          contents: [{ sid: 'HXabc123', approval_requests: { status: 'APPROVED' } }],
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    mockSelect.mockReturnValue({
      in: () => ({ data: [{ value: 'HXabc123' }, { value: 'HXdef456' }], error: null }),
    })

    const res = await GET()
    const json = await res.json()
    expect(json.credentialsValid).toBe(true)
    expect(json.phoneNumberRegistered).toBe(true)
    expect(json.templateApproved).toBe(true)
    expect(Object.keys(json.errors)).toHaveLength(0)
  })
})
