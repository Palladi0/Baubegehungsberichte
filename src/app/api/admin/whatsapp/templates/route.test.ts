import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks ---

vi.mock('@/lib/auth', () => ({
  requireAdmin: vi.fn(),
}))

import { requireAdmin } from '@/lib/auth'
import { GET } from './route'

const adminAuth = { ok: true as const, userId: 'admin-uuid', email: 'admin@test.de', role: 'admin' }
const unauthResult = { ok: false as const, error: 'Nicht authentifiziert', status: 401 as const }

const twilioTemplateResponse = {
  contents: [
    {
      sid: 'HXabc123',
      friendly_name: 'eingangsbestaetigung',
      variables: { 1: 'Projektnummer' },
      approval_requests: { status: 'APPROVED', category: 'UTILITY' },
    },
    {
      sid: 'HXdef456',
      friendly_name: 'unbekannte_nummer',
      variables: {},
      approval_requests: { status: 'PENDING', category: 'UTILITY' },
    },
    {
      sid: 'HXghi789',
      friendly_name: 'old_template',
      variables: {},
      approval_requests: { status: 'REJECTED', category: 'MARKETING' },
    },
  ],
}

describe('GET /api/admin/whatsapp/templates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TWILIO_PRODUCTION_ACCOUNT_SID = 'ACtest123'
    process.env.TWILIO_PRODUCTION_AUTH_TOKEN = 'testtoken456'
    delete process.env.TWILIO_ACCOUNT_SID
    delete process.env.TWILIO_AUTH_TOKEN
  })

  it('gibt 401 zurück ohne Admin-Auth', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(unauthResult)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('gibt 500 zurück wenn keine Twilio-Credentials konfiguriert', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    delete process.env.TWILIO_PRODUCTION_ACCOUNT_SID
    delete process.env.TWILIO_ACCOUNT_SID

    const res = await GET()
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toContain('Credentials')
  })

  it('gibt Template-Liste mit korrekten Status-Werten zurück (200)', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => twilioTemplateResponse,
    }))

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Array.isArray(json)).toBe(true)
    expect(json).toHaveLength(3)

    const approved = json.find((t: { sid: string }) => t.sid === 'HXabc123')
    expect(approved.whatsappApprovalStatus).toBe('APPROVED')
    expect(approved.friendlyName).toBe('eingangsbestaetigung')
    expect(approved.category).toBe('UTILITY')

    const pending = json.find((t: { sid: string }) => t.sid === 'HXdef456')
    expect(pending.whatsappApprovalStatus).toBe('PENDING')

    const rejected = json.find((t: { sid: string }) => t.sid === 'HXghi789')
    expect(rejected.whatsappApprovalStatus).toBe('REJECTED')
  })

  it('gibt leere Liste zurück wenn Twilio keine Templates hat', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ contents: [] }),
    }))

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual([])
  })

  it('gibt Twilio-HTTP-Fehler-Status weiter', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    }))

    const res = await GET()
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toContain('401')
  })

  it('gibt 502 zurück bei Netzwerkfehler', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    const res = await GET()
    expect(res.status).toBe(502)
  })

  it('fällt auf Sandbox-Credentials zurück wenn keine Produktions-Credentials gesetzt', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    delete process.env.TWILIO_PRODUCTION_ACCOUNT_SID
    process.env.TWILIO_ACCOUNT_SID = 'ACsandbox'
    process.env.TWILIO_AUTH_TOKEN = 'sandboxtoken'

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ contents: [] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const res = await GET()
    expect(res.status).toBe(200)
    // Prüfen, dass Basic-Auth mit Sandbox-Credentials gesendet wurde
    const authHeader = fetchMock.mock.calls[0][1]?.headers?.Authorization as string
    const decoded = Buffer.from(authHeader.replace('Basic ', ''), 'base64').toString()
    expect(decoded).toContain('ACsandbox')
  })
})
