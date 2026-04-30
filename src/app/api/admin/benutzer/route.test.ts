import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  requireAdmin: vi.fn(),
}))

const mockListUsers = vi.fn()
const mockCreateUser = vi.fn()
const mockDeleteUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase-service', () => ({
  createServiceClient: () => ({
    auth: {
      admin: {
        listUsers: mockListUsers,
        createUser: mockCreateUser,
        deleteUser: mockDeleteUser,
      },
    },
    from: mockFrom,
  }),
}))

import { requireAdmin } from '@/lib/auth'
import { GET, POST } from './route'

const adminAuth = { ok: true as const, userId: 'admin-uuid', email: 'admin@test.de', role: 'admin' }
const unauthResult = { ok: false as const, error: 'Nicht authentifiziert', status: 401 as const }

function makeRequest(body?: unknown) {
  return {
    json: () => Promise.resolve(body),
  } as unknown as NextRequest
}

const profileRows = [
  {
    id: 'user-1',
    rolle: 'mitarbeiter',
    aktiv: true,
    fehlgeschlagene_versuche: 0,
    gesperrt_bis: null,
    zuletzt_eingeloggt_am: null,
    erstellt_am: '2026-04-24T10:00:00Z',
  },
  {
    id: 'admin-uuid',
    rolle: 'admin',
    aktiv: true,
    fehlgeschlagene_versuche: 0,
    gesperrt_bis: null,
    zuletzt_eingeloggt_am: null,
    erstellt_am: '2026-04-20T10:00:00Z',
  },
]

describe('GET /api/admin/benutzer', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 zurück ohne Admin-Auth', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(unauthResult)
    const res = await GET({} as NextRequest)
    expect(res.status).toBe(401)
  })

  it('gibt Nutzerliste als Array zurück (200)', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)

    const chain = {
      select: vi.fn(),
      order: vi.fn(),
      limit: vi.fn().mockResolvedValue({ data: profileRows, error: null }),
    }
    chain.select.mockReturnValue(chain)
    chain.order.mockReturnValue(chain)
    mockFrom.mockReturnValue(chain)

    mockListUsers.mockResolvedValue({
      data: { users: [{ id: 'user-1', email: 'user@test.de' }, { id: 'admin-uuid', email: 'admin@test.de' }] },
      error: null,
    })

    const res = await GET({} as NextRequest)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(2)
    expect(body[0]).toHaveProperty('email')
    expect(body[0]).toHaveProperty('rolle')
    expect(body[0]).toHaveProperty('aktiv')
  })

  it('gibt 500 zurück bei DB-Fehler', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)

    const chain = {
      select: vi.fn(),
      order: vi.fn(),
      limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
    }
    chain.select.mockReturnValue(chain)
    chain.order.mockReturnValue(chain)
    mockFrom.mockReturnValue(chain)

    const res = await GET({} as NextRequest)
    expect(res.status).toBe(500)
  })
})

describe('POST /api/admin/benutzer', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 zurück ohne Admin-Auth', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(unauthResult)
    const res = await POST(makeRequest({ email: 'new@test.de', rolle: 'mitarbeiter', passwort: 'passwort123' }))
    expect(res.status).toBe(401)
  })

  it('gibt 400 zurück bei fehlender E-Mail', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    const res = await POST(makeRequest({ rolle: 'mitarbeiter', passwort: 'passwort123' }))
    expect(res.status).toBe(400)
  })

  it('gibt 400 zurück bei ungültiger Rolle', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    const res = await POST(makeRequest({ email: 'new@test.de', rolle: 'superuser', passwort: 'passwort123' }))
    expect(res.status).toBe(400)
  })

  it('gibt 400 zurück bei Passwort unter 8 Zeichen', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    const res = await POST(makeRequest({ email: 'new@test.de', rolle: 'mitarbeiter', passwort: 'kurz' }))
    expect(res.status).toBe(400)
  })

  it('legt neuen Nutzer an und gibt 201 zurück', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    const newUser = { id: 'new-user-id', email: 'new@test.de' }
    mockCreateUser.mockResolvedValue({ data: { user: newUser }, error: null })

    const insertChain = {
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    mockFrom.mockReturnValue(insertChain)

    const res = await POST(makeRequest({ email: 'new@test.de', rolle: 'mitarbeiter', passwort: 'sicheresPasswort1' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.email).toBe('new@test.de')
    expect(body.rolle).toBe('mitarbeiter')
    expect(body.aktiv).toBe(true)
  })

  it('gibt 400 zurück wenn E-Mail bereits vergeben', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    mockCreateUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'User already registered' },
    })

    const res = await POST(makeRequest({ email: 'exists@test.de', rolle: 'mitarbeiter', passwort: 'passwort123' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('bereits')
  })

  it('macht Auth-User-Anlage rückgängig wenn Profil-Insert fehlschlägt', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    const newUser = { id: 'new-user-id', email: 'new@test.de' }
    mockCreateUser.mockResolvedValue({ data: { user: newUser }, error: null })
    mockDeleteUser.mockResolvedValue({})

    const insertChain = {
      insert: vi.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } }),
    }
    mockFrom.mockReturnValue(insertChain)

    const res = await POST(makeRequest({ email: 'new@test.de', rolle: 'mitarbeiter', passwort: 'passwort123' }))
    expect(res.status).toBe(500)
    expect(mockDeleteUser).toHaveBeenCalledWith(newUser.id)
  })
})
