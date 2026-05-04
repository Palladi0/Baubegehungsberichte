import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// --- Mocks ---

vi.mock('@/lib/auth', () => ({
  requireAdmin: vi.fn(),
}))

const mockUpsert = vi.fn()
const mockSelect = vi.fn()
const mockFrom = vi.fn(() => ({
  select: mockSelect,
  upsert: mockUpsert,
}))

vi.mock('@/lib/supabase-service', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}))

import { requireAdmin } from '@/lib/auth'
import { GET, POST } from './route'

const adminAuth = { ok: true as const, userId: 'admin-uuid', email: 'admin@test.de', role: 'admin' }
const unauthResult = { ok: false as const, error: 'Nicht authentifiziert', status: 401 as const }

function makeRequest(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/admin/whatsapp/config', {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

const defaultConfigRows = [
  { key: 'whatsapp_mode', value: 'sandbox', updated_at: '2026-04-23T10:00:00Z' },
  { key: 'whatsapp_active_number', value: '+4989123456', updated_at: '2026-04-23T10:00:00Z' },
  { key: 'whatsapp_template_sid_bestaetigung', value: 'HXabc123', updated_at: '2026-04-23T10:00:00Z' },
  { key: 'whatsapp_template_sid_unbekannt', value: 'HXdef456', updated_at: '2026-04-23T10:00:00Z' },
]

describe('GET /api/admin/whatsapp/config', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 zurück ohne Admin-Auth', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(unauthResult)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('gibt Konfiguration zurück (200)', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    mockSelect.mockReturnValue({
      in: () => ({ limit: () => ({ data: defaultConfigRows, error: null }) }),
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.whatsapp_mode).toBe('sandbox')
    expect(json.whatsapp_active_number).toBe('+4989123456')
    expect(json.whatsapp_template_sid_bestaetigung).toBe('HXabc123')
    expect(json.whatsapp_template_sid_unbekannt).toBe('HXdef456')
  })

  it('gibt 500 zurück bei Datenbankfehler', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    mockSelect.mockReturnValue({
      in: () => ({ limit: () => ({ data: null, error: { message: 'DB error' } }) }),
    })

    const res = await GET()
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('Datenbankfehler')
  })
})

describe('POST /api/admin/whatsapp/config', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 zurück ohne Admin-Auth', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(unauthResult)
    const res = await POST(makeRequest('POST', { whatsapp_mode: 'production' }))
    expect(res.status).toBe(401)
  })

  it('gibt 400 zurück bei ungültigem JSON', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    const req = new NextRequest('http://localhost/api/admin/whatsapp/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'kein-json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Ungültiges JSON')
  })

  it('gibt 400 zurück bei ungültigem Modus-Wert', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    const res = await POST(makeRequest('POST', { whatsapp_mode: 'invalid' }))
    expect(res.status).toBe(400)
  })

  it('gibt 400 zurück bei ungültigem E.164-Format (BUG-2 Regression)', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    for (const invalid of ['abc', '+', '004989123456', '+0123']) {
      const res = await POST(makeRequest('POST', { whatsapp_active_number: invalid }))
      expect(res.status, `Erwartet 400 für "${invalid}"`).toBe(400)
    }
  })

  it('gibt 400 zurück bei ungültigem Template-SID-Format (BUG-3 Regression)', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    for (const invalid of ['HXabc123', 'invalid', 'HX' + 'z'.repeat(32), 'HX' + 'a'.repeat(31)]) {
      const res = await POST(makeRequest('POST', { whatsapp_template_sid_bestaetigung: invalid }))
      expect(res.status, `Erwartet 400 für "${invalid}"`).toBe(400)
    }
  })

  it('gibt 400 zurück bei leerem Body (keine Felder)', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    const res = await POST(makeRequest('POST', {}))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Keine Felder angegeben')
  })

  it('schaltet Modus auf production um (200)', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    mockUpsert.mockResolvedValue({ error: null })

    const res = await POST(makeRequest('POST', { whatsapp_mode: 'production' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ key: 'whatsapp_mode', value: 'production' }),
      ]),
      { onConflict: 'key' }
    )
  })

  it('speichert aktive Nummer und Template-SIDs (200)', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    mockUpsert.mockResolvedValue({ error: null })

    const validSid = 'HX' + 'a'.repeat(32)
    const res = await POST(makeRequest('POST', {
      whatsapp_active_number: '+4989987654',
      whatsapp_template_sid_bestaetigung: validSid,
    }))
    expect(res.status).toBe(200)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ key: 'whatsapp_active_number', value: '+4989987654' }),
        expect.objectContaining({ key: 'whatsapp_template_sid_bestaetigung', value: validSid }),
      ]),
      { onConflict: 'key' }
    )
  })

  it('gibt 500 zurück bei Datenbankfehler', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    mockUpsert.mockResolvedValue({ error: { message: 'DB error' } })

    const res = await POST(makeRequest('POST', { whatsapp_mode: 'sandbox' }))
    expect(res.status).toBe(500)
  })
})
