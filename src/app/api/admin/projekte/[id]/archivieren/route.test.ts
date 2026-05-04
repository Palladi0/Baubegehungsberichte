import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  requireAdmin: vi.fn(),
}))

const state = {
  selectResult: { data: null as unknown, error: null as unknown },
  updateResult: { data: null as unknown, error: null as unknown },
}

vi.mock('@/lib/supabase-service', () => ({
  createServiceClient: () => {
    let fromCall = 0
    return {
      from: vi.fn(() => {
        fromCall += 1
        // First .from() call in PATCH = select archive_at; second .from() call = update
        const isSelectCall = fromCall === 1
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const chain: any = {
          select: () => chain,
          update: () => chain,
          eq: () => chain,
          single: () =>
            Promise.resolve(isSelectCall ? state.selectResult : state.updateResult),
        }
        return chain
      }),
    }
  },
}))

import { requireAdmin } from '@/lib/auth'
import { PATCH } from './route'

const adminAuth = { ok: true as const, userId: 'a', email: 'a@b', role: 'admin' }
const unauth = { ok: false as const, error: 'Nicht authentifiziert', status: 401 }

function ctx(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('PATCH /api/admin/projekte/[id]/archivieren', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.selectResult = { data: null, error: null }
    state.updateResult = { data: null, error: null }
  })

  it('gibt 401 zurück ohne Admin-Auth', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(unauth)
    const req = new NextRequest('http://localhost/api/admin/projekte/abc/archivieren', {
      method: 'PATCH',
    })
    const res = await PATCH(req, ctx('abc'))
    expect(res.status).toBe(401)
  })

  it('gibt 404 zurück wenn Projekt nicht existiert', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    state.selectResult = { data: null, error: null }
    const req = new NextRequest('http://localhost/api/admin/projekte/nix/archivieren', {
      method: 'PATCH',
    })
    const res = await PATCH(req, ctx('nix'))
    expect(res.status).toBe(404)
  })

  it('gibt 409 zurück wenn Projekt bereits archiviert ist', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    state.selectResult = {
      data: { id: 'p1', archived_at: '2026-04-22T10:00:00Z' },
      error: null,
    }
    const req = new NextRequest('http://localhost/api/admin/projekte/p1/archivieren', {
      method: 'PATCH',
    })
    const res = await PATCH(req, ctx('p1'))
    expect(res.status).toBe(409)
  })

  it('archiviert erfolgreich und gibt aktualisiertes Projekt zurück', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    state.selectResult = { data: { id: 'p1', archived_at: null }, error: null }
    state.updateResult = {
      data: { id: 'p1', archived_at: '2026-04-24T00:00:00Z' },
      error: null,
    }
    const req = new NextRequest('http://localhost/api/admin/projekte/p1/archivieren', {
      method: 'PATCH',
    })
    const res = await PATCH(req, ctx('p1'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.archived_at).toBeTruthy()
  })
})
