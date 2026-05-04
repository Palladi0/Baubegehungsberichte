import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
}))

const mockOrder = vi.fn()
const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockEq = vi.fn()
const mockSelect = vi.fn()
const mockSingle = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase-service', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}))

import { requireAuth, requireAdmin } from '@/lib/auth'
import { GET, POST } from './route'

const adminAuth = { ok: true as const, userId: 'admin-uuid', email: 'admin@test.de', role: 'admin' }
const userAuth = { ok: true as const, userId: 'user-uuid', email: 'user@test.de', role: 'mitarbeiter' }
const unauthResult = { ok: false as const, error: 'Nicht authentifiziert', status: 401 as const }

const templateRow = {
  id: 'tpl-1',
  name: 'Professionell',
  ist_standard: true,
  logo_pfad: null,
  firmenname: 'PPB Architekten',
  primaerfarbe: '#1a1a1a',
  sekundaerfarbe: '#374151',
  kopfzeilen_text: 'Baustellenbegehungsbericht',
  fusszeilen_text: '',
  schriftgroesse: 'mittel',
  erstellt_am: '2026-04-24T10:00:00Z',
  geaendert_am: '2026-04-24T10:00:00Z',
}

function makeRequest(body?: unknown) {
  return new NextRequest('http://localhost/api/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

describe('GET /api/templates', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 zurück ohne Authentifizierung', async () => {
    vi.mocked(requireAuth).mockResolvedValue(unauthResult)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('gibt alle Templates als Array zurück (200)', async () => {
    vi.mocked(requireAuth).mockResolvedValue(userAuth)
    mockOrder.mockReturnValue({
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: [templateRow], error: null }),
      }),
    })
    mockSelect.mockReturnValue({ order: mockOrder })
    mockFrom.mockReturnValue({ select: mockSelect })

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Array.isArray(json)).toBe(true)
    expect(json[0].id).toBe('tpl-1')
  })

  it('fügt logo_url hinzu wenn logo_pfad vorhanden', async () => {
    vi.mocked(requireAuth).mockResolvedValue(userAuth)
    const withLogo = { ...templateRow, logo_pfad: 'uploads/templates/tpl-1/logo.png' }
    mockOrder.mockReturnValue({
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: [withLogo], error: null }),
      }),
    })
    mockSelect.mockReturnValue({ order: mockOrder })
    mockFrom.mockReturnValue({ select: mockSelect })

    const res = await GET()
    const json = await res.json()
    expect(json[0].logo_url).toContain('/api/templates/tpl-1/logo')
  })

  it('gibt logo_url: null zurück wenn kein logo_pfad', async () => {
    vi.mocked(requireAuth).mockResolvedValue(userAuth)
    mockOrder.mockReturnValue({
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: [templateRow], error: null }),
      }),
    })
    mockSelect.mockReturnValue({ order: mockOrder })
    mockFrom.mockReturnValue({ select: mockSelect })

    const res = await GET()
    const json = await res.json()
    expect(json[0].logo_url).toBeNull()
  })

  it('gibt 500 bei Datenbankfehler zurück', async () => {
    vi.mocked(requireAuth).mockResolvedValue(userAuth)
    mockOrder.mockReturnValue({
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
      }),
    })
    mockSelect.mockReturnValue({ order: mockOrder })
    mockFrom.mockReturnValue({ select: mockSelect })

    const res = await GET()
    expect(res.status).toBe(500)
  })

  it('Mitarbeiter (nicht Admin) kann Templates lesen', async () => {
    vi.mocked(requireAuth).mockResolvedValue(userAuth)
    mockOrder.mockReturnValue({
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: [templateRow], error: null }),
      }),
    })
    mockSelect.mockReturnValue({ order: mockOrder })
    mockFrom.mockReturnValue({ select: mockSelect })

    const res = await GET()
    expect(res.status).toBe(200)
  })
})

describe('POST /api/templates', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 zurück ohne Admin-Auth', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(unauthResult)
    const res = await POST(makeRequest({ name: 'Test' }))
    expect(res.status).toBe(401)
  })

  it('gibt 422 bei ungültigem HEX-Farbwert zurück', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    const res = await POST(makeRequest({ name: 'Test', primaerfarbe: 'nicht-hex' }))
    expect(res.status).toBe(422)
  })

  it('gibt 422 bei fehlendem Namen zurück', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    const res = await POST(makeRequest({ primaerfarbe: '#000000' }))
    expect(res.status).toBe(422)
  })

  it('gibt 400 bei ungültigem JSON zurück', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    const req = new NextRequest('http://localhost/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'kein-json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('legt neues Template an (201)', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    mockSingle.mockResolvedValue({ data: { ...templateRow, id: 'tpl-new' }, error: null })
    mockSelect.mockReturnValue({ single: mockSingle })
    mockInsert.mockReturnValue({ select: mockSelect })
    mockFrom.mockReturnValue({ insert: mockInsert, update: mockUpdate.mockReturnValue({ eq: mockEq.mockResolvedValue({ error: null }) }) })

    const res = await POST(makeRequest({ name: 'Neue Vorlage' }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.id).toBe('tpl-new')
  })

  it('setzt alle anderen Standards auf false wenn ist_standard=true', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    mockSingle.mockResolvedValue({ data: { ...templateRow, id: 'tpl-new' }, error: null })
    mockSelect.mockReturnValue({ single: mockSingle })
    mockInsert.mockReturnValue({ select: mockSelect })
    const mockUpdateEq = vi.fn().mockResolvedValue({ error: null })
    const mockUpdateChain = vi.fn().mockReturnValue({ eq: mockUpdateEq })
    mockFrom.mockReturnValue({
      insert: mockInsert,
      update: mockUpdateChain,
    })

    const res = await POST(makeRequest({ name: 'Standard', ist_standard: true }))
    expect(res.status).toBe(201)
    // update({ist_standard: false}).eq('ist_standard', true) should have been called
    expect(mockUpdateChain).toHaveBeenCalledWith({ ist_standard: false })
    expect(mockUpdateEq).toHaveBeenCalledWith('ist_standard', true)
  })
})
