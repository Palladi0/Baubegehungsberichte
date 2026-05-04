import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
}))

const state = {
  adminList: { data: [] as unknown[], error: null as unknown },
  pmList: { data: [] as Array<{ projekt_id: string }>, error: null as unknown },
  memberList: { data: [] as unknown[], error: null as unknown },
}

vi.mock('@/lib/supabase-service', () => ({
  createServiceClient: () => {
    let call = 0
    return {
      from: vi.fn((tbl: string) => {
        call += 1
        if (tbl === 'projekt_mitarbeiter') {
          return {
            select: () => ({
              eq: () => Promise.resolve(state.pmList),
            }),
          }
        }
        // projekte
        const chain = {
          select: () => chain,
          order: () => chain,
          limit: () => chain,
          not: () => chain,
          is: () => chain,
          in: () => chain,
          eq: () => chain,
          then: (resolve: (v: unknown) => unknown) => {
            // First call is admin list; if there was a pmList call before, treat as member list
            const result = call === 1 ? state.adminList : state.memberList
            return Promise.resolve(result).then(resolve)
          },
        }
        return chain
      }),
    }
  },
}))

import { requireAuth } from '@/lib/auth'
import { GET } from './route'

const admin = { ok: true as const, userId: 'a-1', email: 'a@b', role: 'admin' }
const mitarbeiter = { ok: true as const, userId: 'u-1', email: 'u@b', role: 'mitarbeiter' }
const unauth = { ok: false as const, error: 'Nicht authentifiziert', status: 401 }

function makeReq(url = 'http://localhost/api/projekte') {
  return new NextRequest(url)
}

describe('GET /api/projekte', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.adminList = { data: [], error: null }
    state.pmList = { data: [], error: null }
    state.memberList = { data: [], error: null }
  })

  it('gibt 401 zurück ohne Authentifizierung', async () => {
    vi.mocked(requireAuth).mockResolvedValue(unauth)
    const res = await GET(makeReq())
    expect(res.status).toBe(401)
  })

  it('Admin sieht alle Projekte', async () => {
    vi.mocked(requireAuth).mockResolvedValue(admin)
    state.adminList = {
      data: [{ id: 'p1', name: 'Alpha', archived_at: null }],
      error: null,
    }
    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveLength(1)
    expect(json[0].name).toBe('Alpha')
  })

  it('Mitarbeiter ohne Zuordnung erhält leere Liste (nicht 403)', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mitarbeiter)
    state.pmList = { data: [], error: null }
    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual([])
  })

  it('Mitarbeiter sieht nur Projekte, denen er zugeordnet ist', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mitarbeiter)
    state.pmList = { data: [{ projekt_id: 'p1' }], error: null }
    state.memberList = {
      data: [{ id: 'p1', name: 'Mein Projekt', archived_at: null }],
      error: null,
    }
    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveLength(1)
    expect(json[0].id).toBe('p1')
  })
})
