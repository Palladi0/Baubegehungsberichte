import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockSignInWithPassword = vi.fn()
const mockSignOut = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  createServerActionClient: async () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
    },
  }),
}))

const mockListUsers = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase-service', () => ({
  createServiceClient: () => ({
    auth: { admin: { listUsers: mockListUsers } },
    from: mockFrom,
  }),
}))

import { POST } from './route'

const knownUser = { id: 'user-uuid-123', email: 'mitarbeiter@test.de' }
const knownSession = { access_token: 'tok', refresh_token: 'ref' }

function makeRequest(body: unknown) {
  return {
    json: () => Promise.resolve(body),
  } as unknown as NextRequest
}

function makeFromChain(singleResult: unknown) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn().mockResolvedValue(singleResult),
    update: vi.fn(),
  }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.update.mockReturnValue(chain)
  return chain
}

function makeUpdateChain() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    update: vi.fn(),
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  }
  chain.update.mockReturnValue(chain)
  return chain
}

describe('POST /api/auth/login', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 400 zurück bei invalidem JSON', async () => {
    const req = {
      json: () => Promise.reject(new SyntaxError('invalid json')),
    } as unknown as NextRequest
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('gibt 400 zurück bei ungültiger E-Mail-Adresse', async () => {
    const res = await POST(makeRequest({ email: 'kein-email', passwort: 'passwort123' }))
    expect(res.status).toBe(400)
  })

  it('gibt 401 zurück bei unbekannter E-Mail (kein User-Enumeration)', async () => {
    mockListUsers.mockResolvedValue({ data: { users: [] } })
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: { message: 'invalid' } })

    const res = await POST(makeRequest({ email: 'unbekannt@test.de', passwort: 'Passwort123' }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('E-Mail oder Passwort ungültig.')
  })

  it('gibt 403 zurück wenn Account deaktiviert', async () => {
    mockListUsers.mockResolvedValue({ data: { users: [knownUser] } })
    mockFrom.mockReturnValue(
      makeFromChain({ data: { aktiv: false, gesperrt_bis: null, fehlgeschlagene_versuche: 0 }, error: null })
    )

    const res = await POST(makeRequest({ email: knownUser.email, passwort: 'Passwort123' }))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toContain('deaktiviert')
  })

  it('gibt 401 mit generischer Fehlermeldung zurück wenn Account gesperrt (kein User-Enumeration)', async () => {
    const futureDate = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    mockListUsers.mockResolvedValue({ data: { users: [knownUser] } })
    mockFrom.mockReturnValue(
      makeFromChain({ data: { aktiv: true, gesperrt_bis: futureDate, fehlgeschlagene_versuche: 5 }, error: null })
    )

    const res = await POST(makeRequest({ email: knownUser.email, passwort: 'Passwort123' }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('E-Mail oder Passwort ungültig.')
  })

  it('inkrementiert Fehlversuche bei falschem Passwort (bekannte E-Mail)', async () => {
    mockListUsers.mockResolvedValue({ data: { users: [knownUser] } })
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: { message: 'invalid' } })

    const profileChain = makeFromChain({
      data: { aktiv: true, gesperrt_bis: null, fehlgeschlagene_versuche: 0 },
      error: null,
    })
    const countChain = makeFromChain({ data: { fehlgeschlagene_versuche: 2 }, error: null })
    const updateChain = makeUpdateChain()

    mockFrom
      .mockReturnValueOnce(profileChain)
      .mockReturnValueOnce(countChain)
      .mockReturnValueOnce(updateChain)

    await POST(makeRequest({ email: knownUser.email, passwort: 'WrongPass1' }))

    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ fehlgeschlagene_versuche: 3 })
    )
  })

  it('setzt gesperrt_bis beim 5. Fehlversuch', async () => {
    mockListUsers.mockResolvedValue({ data: { users: [knownUser] } })
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: { message: 'invalid' } })

    const profileChain = makeFromChain({
      data: { aktiv: true, gesperrt_bis: null, fehlgeschlagene_versuche: 0 },
      error: null,
    })
    const countChain = makeFromChain({ data: { fehlgeschlagene_versuche: 4 }, error: null })
    const updateChain = makeUpdateChain()

    mockFrom
      .mockReturnValueOnce(profileChain)
      .mockReturnValueOnce(countChain)
      .mockReturnValueOnce(updateChain)

    await POST(makeRequest({ email: knownUser.email, passwort: 'WrongPass1' }))

    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ gesperrt_bis: expect.any(String) })
    )
  })

  it('login erfolgreich: gibt 200 zurück und setzt Fehlversuche zurück', async () => {
    mockListUsers.mockResolvedValue({ data: { users: [knownUser] } })
    mockSignInWithPassword.mockResolvedValue({
      data: { user: knownUser, session: knownSession },
      error: null,
    })

    const preAuthChain = makeFromChain({
      data: { aktiv: true, gesperrt_bis: null, fehlgeschlagene_versuche: 1 },
      error: null,
    })
    const postAuthChain = makeFromChain({
      data: { aktiv: true, gesperrt_bis: null },
      error: null,
    })
    const updateChain = makeUpdateChain()

    mockFrom
      .mockReturnValueOnce(preAuthChain)
      .mockReturnValueOnce(postAuthChain)
      .mockReturnValueOnce(updateChain)

    const res = await POST(makeRequest({ email: knownUser.email, passwort: 'RichtigesPasswort1' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ fehlgeschlagene_versuche: 0, gesperrt_bis: null })
    )
  })

  it('meldet User ab und gibt 403 wenn Account nach erfolgreichem Auth deaktiviert ist', async () => {
    mockListUsers.mockResolvedValue({ data: { users: [knownUser] } })
    mockSignInWithPassword.mockResolvedValue({
      data: { user: knownUser, session: knownSession },
      error: null,
    })
    mockSignOut.mockResolvedValue({})

    const preAuthChain = makeFromChain({
      data: { aktiv: true, gesperrt_bis: null, fehlgeschlagene_versuche: 0 },
      error: null,
    })
    const postAuthChain = makeFromChain({
      data: { aktiv: false, gesperrt_bis: null },
      error: null,
    })

    mockFrom.mockReturnValueOnce(preAuthChain).mockReturnValueOnce(postAuthChain)

    const res = await POST(makeRequest({ email: knownUser.email, passwort: 'RichtigesPasswort1' }))
    expect(res.status).toBe(403)
    expect(mockSignOut).toHaveBeenCalled()
  })
})
