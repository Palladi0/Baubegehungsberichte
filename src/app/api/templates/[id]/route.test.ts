import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
}))

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(false),
    rmSync: vi.fn(),
    readFileSync: vi.fn(),
  },
  existsSync: vi.fn().mockReturnValue(false),
  rmSync: vi.fn(),
  readFileSync: vi.fn(),
}))

vi.mock('path', async () => {
  const actual = await vi.importActual<typeof import('path')>('path')
  return { ...actual, default: actual }
})

const mockSingle = vi.fn()
const mockEq = vi.fn()
const mockEq2 = vi.fn()
const mockSelect = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockHead = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase-service', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}))

import { requireAuth, requireAdmin } from '@/lib/auth'
import { GET, PUT, DELETE } from './route'

const adminAuth = { ok: true as const, userId: 'admin-uuid', email: 'admin@test.de', role: 'admin' }
const unauthResult = { ok: false as const, error: 'Nicht authentifiziert', status: 401 as const }

const templateRow = {
  id: 'tpl-1',
  name: 'Professionell',
  ist_standard: true,
  logo_pfad: null,
  firmenname: 'PPB',
  primaerfarbe: '#1a1a1a',
  sekundaerfarbe: '#374151',
  kopfzeilen_text: 'Test',
  fusszeilen_text: '',
  schriftgroesse: 'mittel',
  erstellt_am: '2026-04-24T10:00:00Z',
  geaendert_am: '2026-04-24T10:00:00Z',
}

function makeRequest(method: string, id: string, body?: unknown) {
  return new NextRequest(`http://localhost/api/templates/${id}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('GET /api/templates/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 ohne Auth zurück', async () => {
    vi.mocked(requireAuth).mockResolvedValue(unauthResult)
    const res = await GET(makeRequest('GET', 'tpl-1'), makeParams('tpl-1'))
    expect(res.status).toBe(401)
  })

  it('gibt 404 für unbekannte ID zurück', async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminAuth)
    mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    mockEq.mockReturnValue({ single: mockSingle })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })

    const res = await GET(makeRequest('GET', 'unknown'), makeParams('unknown'))
    expect(res.status).toBe(404)
  })

  it('gibt Template-Daten zurück (200)', async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminAuth)
    mockSingle.mockResolvedValue({ data: templateRow, error: null })
    mockEq.mockReturnValue({ single: mockSingle })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })

    const res = await GET(makeRequest('GET', 'tpl-1'), makeParams('tpl-1'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.id).toBe('tpl-1')
    expect(json.name).toBe('Professionell')
  })
})

describe('PUT /api/templates/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 ohne Admin-Auth zurück', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(unauthResult)
    const res = await PUT(makeRequest('PUT', 'tpl-1', { name: 'Neu' }), makeParams('tpl-1'))
    expect(res.status).toBe(401)
  })

  it('gibt 422 bei ungültigem HEX-Farbwert zurück', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    const res = await PUT(
      makeRequest('PUT', 'tpl-1', { primaerfarbe: 'nicht-hex' }),
      makeParams('tpl-1')
    )
    expect(res.status).toBe(422)
  })

  it('gibt 400 bei leerem Body zurück', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    const res = await PUT(makeRequest('PUT', 'tpl-1', {}), makeParams('tpl-1'))
    expect(res.status).toBe(400)
  })

  it('aktualisiert Template (200)', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    const updated = { ...templateRow, name: 'Geändert' }
    mockSingle.mockResolvedValue({ data: updated, error: null })
    mockEq.mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockSingle }) })
    mockUpdate.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ update: mockUpdate })

    const res = await PUT(makeRequest('PUT', 'tpl-1', { name: 'Geändert' }), makeParams('tpl-1'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.name).toBe('Geändert')
  })
})

describe('DELETE /api/templates/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 ohne Admin-Auth zurück', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(unauthResult)
    const res = await DELETE(makeRequest('DELETE', 'tpl-1'), makeParams('tpl-1'))
    expect(res.status).toBe(401)
  })

  it('gibt 409 zurück wenn Berichte die Vorlage referenzieren', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)

    let callCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'berichte') {
        return {
          select: vi.fn().mockReturnValue({
            head: vi.fn().mockReturnValue({
              count: 'exact',
              eq: vi.fn().mockResolvedValue({ count: 3, error: null }),
            }),
            eq: vi.fn().mockResolvedValue({ count: 3, error: null }),
          }),
        }
      }
      return { select: vi.fn() }
    })

    // Set up count check: count = 3
    mockHead.mockResolvedValue({ count: 3, error: null })
    const mockCountEq = vi.fn().mockResolvedValue({ count: 3 })
    const mockCountSelect = vi.fn().mockReturnValue({ eq: mockCountEq })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'berichte') return { select: mockCountSelect }
      return {}
    })

    const res = await DELETE(makeRequest('DELETE', 'tpl-1'), makeParams('tpl-1'))
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toContain('3')
  })

  it('gibt 409 zurück wenn Standard-Template gelöscht werden soll', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)

    const mockCountEq = vi.fn().mockResolvedValue({ count: 0 })
    const mockCountSelect = vi.fn().mockReturnValue({ eq: mockCountEq })

    mockSingle.mockResolvedValue({ data: { logo_pfad: null, ist_standard: true }, error: null })
    mockEq2.mockReturnValue({ single: mockSingle })
    const mockVorlageSelect = vi.fn().mockReturnValue({ eq: mockEq2 })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'berichte') return { select: mockCountSelect }
      if (table === 'berichts_vorlagen') return { select: mockVorlageSelect }
      return {}
    })

    const res = await DELETE(makeRequest('DELETE', 'tpl-1'), makeParams('tpl-1'))
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toContain('Standard')
  })

  it('löscht Template erfolgreich (204)', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)

    const mockCountEq = vi.fn().mockResolvedValue({ count: 0 })
    const mockCountSelect = vi.fn().mockReturnValue({ eq: mockCountEq })

    mockSingle.mockResolvedValue({ data: { logo_pfad: null, ist_standard: false }, error: null })
    mockEq2.mockReturnValue({ single: mockSingle })
    const mockVorlageSelect = vi.fn().mockReturnValue({ eq: mockEq2 })

    const mockDeleteEq = vi.fn().mockResolvedValue({ error: null })
    const mockDeleteFn = vi.fn().mockReturnValue({ eq: mockDeleteEq })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'berichte') return { select: mockCountSelect }
      if (table === 'berichts_vorlagen') return { select: mockVorlageSelect, delete: mockDeleteFn }
      return {}
    })

    const res = await DELETE(makeRequest('DELETE', 'tpl-1'), makeParams('tpl-1'))
    expect(res.status).toBe(204)
  })
})
