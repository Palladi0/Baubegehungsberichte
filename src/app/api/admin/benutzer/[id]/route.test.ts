import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  requireAdmin: vi.fn(),
}))

const mockFrom = vi.fn()

vi.mock('@/lib/supabase-service', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}))

import { requireAdmin } from '@/lib/auth'
import { PATCH } from './route'

const adminAuth = { ok: true as const, userId: 'admin-uuid', email: 'admin@test.de', role: 'admin' }
const unauthResult = { ok: false as const, error: 'Nicht authentifiziert', status: 401 as const }

function makeRequest(id: string, body: unknown) {
  return {
    json: () => Promise.resolve(body),
    nextUrl: { pathname: `/api/admin/benutzer/${id}` },
  } as unknown as NextRequest
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

function makeUpdateChain(result: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    update: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
  }
  chain.update.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.select.mockReturnValue(chain)
  return chain
}

describe('PATCH /api/admin/benutzer/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 zurück ohne Admin-Auth', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(unauthResult)
    const res = await PATCH(makeRequest('other-id', { aktiv: false }), makeParams('other-id'))
    expect(res.status).toBe(401)
  })

  it('gibt 400 zurück wenn kein Feld angegeben', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    const res = await PATCH(makeRequest('other-id', {}), makeParams('other-id'))
    expect(res.status).toBe(400)
  })

  it('gibt 400 zurück wenn Admin eigenen Account deaktiviert', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    const res = await PATCH(makeRequest('admin-uuid', { aktiv: false }), makeParams('admin-uuid'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('eigene')
  })

  it('deaktiviert anderen Nutzer erfolgreich', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    const updatedProfile = { id: 'other-uuid', rolle: 'mitarbeiter', aktiv: false, fehlgeschlagene_versuche: 0, gesperrt_bis: null }
    mockFrom.mockReturnValue(makeUpdateChain({ data: updatedProfile, error: null }))

    const res = await PATCH(makeRequest('other-uuid', { aktiv: false }), makeParams('other-uuid'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.aktiv).toBe(false)
  })

  it('reaktiviert Nutzer und setzt Lockout zurück', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    const chain = makeUpdateChain({
      data: { id: 'other-uuid', rolle: 'mitarbeiter', aktiv: true, fehlgeschlagene_versuche: 0, gesperrt_bis: null },
      error: null,
    })
    mockFrom.mockReturnValue(chain)

    const res = await PATCH(makeRequest('other-uuid', { aktiv: true }), makeParams('other-uuid'))
    expect(res.status).toBe(200)
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ aktiv: true, fehlgeschlagene_versuche: 0, gesperrt_bis: null })
    )
  })

  it('ändert Rolle eines Nutzers', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    const chain = makeUpdateChain({
      data: { id: 'other-uuid', rolle: 'admin', aktiv: true, fehlgeschlagene_versuche: 0, gesperrt_bis: null },
      error: null,
    })
    mockFrom.mockReturnValue(chain)

    const res = await PATCH(makeRequest('other-uuid', { rolle: 'admin' }), makeParams('other-uuid'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rolle).toBe('admin')
  })

  it('gibt 500 zurück bei DB-Fehler', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    mockFrom.mockReturnValue(makeUpdateChain({ data: null, error: { message: 'DB error' } }))

    const res = await PATCH(makeRequest('other-uuid', { aktiv: false }), makeParams('other-uuid'))
    expect(res.status).toBe(500)
  })
})
