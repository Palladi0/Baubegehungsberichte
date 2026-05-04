import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  requireAdmin: vi.fn(),
}))

// A tiny chainable builder helper. Each call records the last resolved value
// so tests can customize per call without re-mocking the entire module.
const state = {
  getList: null as unknown,
  existingKuerzel: [] as Array<{ id: string }>,
  insertResult: { data: null as unknown, error: null as unknown },
}

function buildQuery(tableName: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q: any = {
    select: vi.fn(() => q),
    order: vi.fn(() => q),
    limit: vi.fn(() => q),
    not: vi.fn(() => q),
    is: vi.fn(() => q),
    ilike: vi.fn(() => q),
    neq: vi.fn(() => q),
    eq: vi.fn(() => q),
    in: vi.fn(() => q),
    single: vi.fn(),
    insert: vi.fn(() => q),
    update: vi.fn(() => q),
  }
  q.then = (resolve: (v: unknown) => unknown) => {
    if (tableName === 'projekte-list') {
      return Promise.resolve(state.getList).then(resolve)
    }
    if (tableName === 'projekte-existing') {
      return Promise.resolve({ data: state.existingKuerzel, error: null }).then(resolve)
    }
    return Promise.resolve({ data: null, error: null }).then(resolve)
  }
  return q
}

vi.mock('@/lib/supabase-service', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createServiceClient: () => {
    let call = 0
    return {
      from: vi.fn(() => {
        call += 1
        // First call in POST = kuerzel existence check, second call = insert.
        // For GET it's the only call (list).
        if (call === 1) {
          // Either list or existing check depending on route. We resolve via `then` override below.
          return {
            select: (_arg?: string) => {
              // Used for list path — expose chain returning final data via terminal method
              const chain = {
                order: () => chain,
                limit: () => chain,
                not: () => chain,
                is: () => chain,
                eq: () => chain,
                ilike: () => chain,
                neq: () => chain,
                in: () => chain,
                then: (resolve: (v: unknown) => unknown) => {
                  return Promise.resolve(state.getList).then(resolve)
                },
              }
              return chain
            },
          }
        }
        // second call => insert branch
        return {
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve(state.insertResult),
            }),
          }),
        }
      }),
    }
  },
}))

import { requireAdmin } from '@/lib/auth'
import { GET, POST } from './route'

const adminAuth = { ok: true as const, userId: 'admin-uuid', email: 'a@b.de', role: 'admin' }
const unauth = { ok: false as const, error: 'Nicht authentifiziert', status: 401 }

function makeRequest(method: string, body?: unknown, url = 'http://localhost/api/admin/projekte') {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('GET /api/admin/projekte', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.getList = { data: [], error: null }
  })

  it('gibt 401 zurück ohne Admin-Rechte', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(unauth)
    const res = await GET(makeRequest('GET'))
    expect(res.status).toBe(401)
  })

  it('gibt 403 zurück, wenn Nicht-Admin authentifiziert', async () => {
    vi.mocked(requireAdmin).mockResolvedValue({
      ok: false,
      error: 'Zugriff verweigert — Admin-Rolle erforderlich',
      status: 403,
    })
    const res = await GET(makeRequest('GET'))
    expect(res.status).toBe(403)
  })

  it('gibt Projektliste als JSON-Array zurück', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    state.getList = {
      data: [
        {
          id: 'p1',
          name: 'Test',
          nummer: '2024-001',
          kuerzel: 'BV-24-HH',
          auftraggeber: null,
          bauherr: null,
          adresse: null,
          start_datum: null,
          end_datum: null,
          beschreibung: null,
          archived_at: null,
          erstellt_am: '2026-04-22',
          aktualisiert_am: '2026-04-22',
          projekt_mitarbeiter: [{ nutzer_id: 'u1' }, { nutzer_id: 'u2' }],
        },
      ],
      error: null,
    }
    const res = await GET(makeRequest('GET'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Array.isArray(json)).toBe(true)
    expect(json[0].mitarbeiter_anzahl).toBe(2)
  })
})

describe('POST /api/admin/projekte', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.existingKuerzel = []
    state.getList = { data: [], error: null }
  })

  it('gibt 401 zurück ohne Admin-Rechte', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(unauth)
    const res = await POST(makeRequest('POST', { name: 'x', nummer: '1', kuerzel: 'AB' }))
    expect(res.status).toBe(401)
  })

  it('gibt 400 bei ungültigem Kürzel (enthält Leerzeichen)', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    const res = await POST(
      makeRequest('POST', { name: 'Test', nummer: '2024-001', kuerzel: 'BV 24 HH' })
    )
    expect(res.status).toBe(400)
  })

  it('gibt 400 bei fehlendem Pflichtfeld (kein name)', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    const res = await POST(makeRequest('POST', { nummer: '1', kuerzel: 'AB' }))
    expect(res.status).toBe(400)
  })

  it('gibt 400 bei ungültigem JSON-Body', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    const req = new NextRequest('http://localhost/api/admin/projekte', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('gibt 400, wenn Kürzel zu lang (> 20 Zeichen)', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    const res = await POST(
      makeRequest('POST', { name: 'Test', nummer: '1', kuerzel: 'A'.repeat(21) })
    )
    expect(res.status).toBe(400)
  })
})
