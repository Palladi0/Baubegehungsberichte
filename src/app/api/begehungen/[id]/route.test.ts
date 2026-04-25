import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, PUT, DELETE } from './route'

vi.mock('@/lib/supabase-service', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
}))

import { createServiceClient } from '@/lib/supabase-service'
import { requireAuth } from '@/lib/auth'

function makeRequest(body?: unknown): NextRequest {
  return {
    json: () => Promise.resolve(body),
  } as unknown as NextRequest
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

// Builds a chainable Supabase query mock for a single .single() call
function makeSingleChain(singleResult: { data: unknown; error: unknown }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    insert: vi.fn(),
    single: vi.fn().mockResolvedValue(singleResult),
  }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.update.mockReturnValue(chain)
  chain.delete.mockReturnValue(chain)
  chain.insert.mockReturnValue(chain)
  return chain
}

function setupAuth(role: 'admin' | 'mitarbeiter' = 'mitarbeiter', userId = 'user-1') {
  vi.mocked(requireAuth).mockResolvedValue({
    ok: true,
    userId,
    role,
    email: `${role}@test.de`,
  } as Awaited<ReturnType<typeof requireAuth>>)
}

function setupUnauth() {
  vi.mocked(requireAuth).mockResolvedValue({
    ok: false,
    error: 'Nicht authentifiziert',
    status: 401,
  } as Awaited<ReturnType<typeof requireAuth>>)
}

const begehungOwnerId = 'user-1'
const otherUserId = 'user-2'

const sampleBegehung = {
  id: 'begehung-1',
  datum: '2026-04-24',
  uhrzeit: '10:00:00',
  wetterbedingungen: 'Sonnig',
  temperatur: 18,
  leistungsstand: 'Rohbau 60%',
  vorkommnisse: null,
  massnahmen: null,
  bemerkungen: null,
  status: 'Entwurf',
  erstellt_am: '2026-04-24T10:00:00Z',
  aktualisiert_am: '2026-04-24T10:00:00Z',
  projekt: { id: 'projekt-1', name: 'Testprojekt', kuerzel: 'TP' },
  bearbeiter: { id: begehungOwnerId, email: 'user@test.de' },
  teilnehmer: [],
}

beforeEach(() => {
  vi.resetAllMocks()
})

// ─── GET /api/begehungen/[id] ────────────────────────────────────────────────

describe('GET /api/begehungen/[id]', () => {
  it('gibt 401 zurück ohne Auth', async () => {
    setupUnauth()
    const res = await GET(makeRequest(), makeParams('begehung-1'))
    expect(res.status).toBe(401)
  })

  it('gibt 404 zurück wenn Begehung nicht existiert', async () => {
    setupAuth()
    const chain = makeSingleChain({ data: null, error: { code: 'PGRST116' } })
    vi.mocked(createServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as unknown as ReturnType<typeof createServiceClient>)

    const res = await GET(makeRequest(), makeParams('nonexistent'))
    expect(res.status).toBe(404)
  })

  it('gibt 403 zurück wenn Mitarbeiter eine fremde Begehung abruft', async () => {
    setupAuth('mitarbeiter', otherUserId)
    const chain = makeSingleChain({ data: sampleBegehung, error: null })
    vi.mocked(createServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as unknown as ReturnType<typeof createServiceClient>)

    const res = await GET(makeRequest(), makeParams('begehung-1'))
    expect(res.status).toBe(403)
  })

  it('gibt 200 zurück wenn Mitarbeiter eigene Begehung abruft', async () => {
    setupAuth('mitarbeiter', begehungOwnerId)
    const chain = makeSingleChain({ data: sampleBegehung, error: null })
    vi.mocked(createServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as unknown as ReturnType<typeof createServiceClient>)

    const res = await GET(makeRequest(), makeParams('begehung-1'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.id).toBe('begehung-1')
    expect(json.status).toBe('Entwurf')
  })

  it('Admin kann fremde Begehung abrufen', async () => {
    setupAuth('admin', 'admin-1')
    const chain = makeSingleChain({ data: sampleBegehung, error: null })
    vi.mocked(createServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as unknown as ReturnType<typeof createServiceClient>)

    const res = await GET(makeRequest(), makeParams('begehung-1'))
    expect(res.status).toBe(200)
  })
})

// ─── PUT /api/begehungen/[id] ────────────────────────────────────────────────

describe('PUT /api/begehungen/[id]', () => {
  it('gibt 401 zurück ohne Auth', async () => {
    setupUnauth()
    const res = await PUT(makeRequest({}), makeParams('begehung-1'))
    expect(res.status).toBe(401)
  })

  it('gibt 422 zurück bei ungültigem Body (falsches Datum-Format)', async () => {
    setupAuth()
    const fromMock = vi.fn()
    vi.mocked(createServiceClient).mockReturnValue({ from: fromMock } as unknown as ReturnType<typeof createServiceClient>)

    const res = await PUT(makeRequest({ datum: 'kein-datum' }), makeParams('begehung-1'))
    expect(res.status).toBe(422)
  })

  it('gibt 403 zurück wenn Mitarbeiter eine fremde Begehung aktualisiert', async () => {
    setupAuth('mitarbeiter', otherUserId)
    const chain = makeSingleChain({ data: { id: 'begehung-1', bearbeiter_id: begehungOwnerId }, error: null })
    vi.mocked(createServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as unknown as ReturnType<typeof createServiceClient>)

    const res = await PUT(makeRequest({ status: 'Fertig' }), makeParams('begehung-1'))
    expect(res.status).toBe(403)
  })

  it('gibt 404 zurück wenn Begehung nicht existiert', async () => {
    setupAuth('mitarbeiter', begehungOwnerId)
    const chain = makeSingleChain({ data: null, error: { code: 'PGRST116' } })
    vi.mocked(createServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as unknown as ReturnType<typeof createServiceClient>)

    const res = await PUT(makeRequest({ status: 'Fertig' }), makeParams('nonexistent'))
    expect(res.status).toBe(404)
  })

  it('aktualisiert erfolgreich wenn Mitarbeiter eigene Begehung bearbeitet', async () => {
    setupAuth('mitarbeiter', begehungOwnerId)

    let callCount = 0
    const chain: Record<string, ReturnType<typeof vi.fn>> = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // find existing begehung
          return Promise.resolve({ data: { id: 'begehung-1', bearbeiter_id: begehungOwnerId }, error: null })
        }
        return Promise.resolve({ data: null, error: null })
      }),
    }
    Object.keys(chain).forEach((k) => {
      if (k !== 'single') (chain[k] as ReturnType<typeof vi.fn>).mockReturnValue(chain)
    })

    vi.mocked(createServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as unknown as ReturnType<typeof createServiceClient>)

    const res = await PUT(makeRequest({ status: 'Fertig' }), makeParams('begehung-1'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.id).toBe('begehung-1')
  })
})

// ─── DELETE /api/begehungen/[id] ─────────────────────────────────────────────

describe('DELETE /api/begehungen/[id]', () => {
  it('gibt 401 zurück ohne Auth', async () => {
    setupUnauth()
    const res = await DELETE(makeRequest(), makeParams('begehung-1'))
    expect(res.status).toBe(401)
  })

  it('gibt 403 zurück wenn Mitarbeiter eine fremde Begehung löscht', async () => {
    setupAuth('mitarbeiter', otherUserId)

    let callCount = 0
    const chain: Record<string, ReturnType<typeof vi.fn>> = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return Promise.resolve({ data: { id: 'begehung-1', bearbeiter_id: begehungOwnerId }, error: null })
        }
        return Promise.resolve({ data: null, error: null })
      }),
    }
    Object.keys(chain).forEach((k) => {
      if (k !== 'single') (chain[k] as ReturnType<typeof vi.fn>).mockReturnValue(chain)
    })
    vi.mocked(createServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as unknown as ReturnType<typeof createServiceClient>)

    const res = await DELETE(makeRequest(), makeParams('begehung-1'))
    expect(res.status).toBe(403)
  })

  it('gibt 404 zurück wenn Begehung nicht existiert', async () => {
    setupAuth('mitarbeiter', begehungOwnerId)
    const chain = makeSingleChain({ data: null, error: null })
    vi.mocked(createServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as unknown as ReturnType<typeof createServiceClient>)

    const res = await DELETE(makeRequest(), makeParams('nonexistent'))
    expect(res.status).toBe(404)
  })

  it('löscht erfolgreich wenn Mitarbeiter eigene Begehung löscht', async () => {
    setupAuth('mitarbeiter', begehungOwnerId)

    let callCount = 0
    const chain: Record<string, ReturnType<typeof vi.fn>> = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return Promise.resolve({ data: { id: 'begehung-1', bearbeiter_id: begehungOwnerId }, error: null })
        }
        return Promise.resolve({ data: null, error: null })
      }),
    }
    Object.keys(chain).forEach((k) => {
      if (k !== 'single') (chain[k] as ReturnType<typeof vi.fn>).mockReturnValue(chain)
    })
    vi.mocked(createServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as unknown as ReturnType<typeof createServiceClient>)

    const res = await DELETE(makeRequest(), makeParams('begehung-1'))
    expect(res.status).toBe(204)
  })

  it('Admin kann fremde Begehung löschen', async () => {
    setupAuth('admin', 'admin-1')

    let callCount = 0
    const chain: Record<string, ReturnType<typeof vi.fn>> = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return Promise.resolve({ data: { id: 'begehung-1', bearbeiter_id: begehungOwnerId }, error: null })
        }
        return Promise.resolve({ data: null, error: null })
      }),
    }
    Object.keys(chain).forEach((k) => {
      if (k !== 'single') (chain[k] as ReturnType<typeof vi.fn>).mockReturnValue(chain)
    })
    vi.mocked(createServiceClient).mockReturnValue({ from: vi.fn().mockReturnValue(chain) } as unknown as ReturnType<typeof createServiceClient>)

    const res = await DELETE(makeRequest(), makeParams('begehung-1'))
    expect(res.status).toBe(204)
  })
})
