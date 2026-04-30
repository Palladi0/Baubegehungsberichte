import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
}))

const mockSignInWithPassword = vi.fn()
const mockUpdateUserById = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
    },
  }),
}))

vi.mock('@/lib/supabase-service', () => ({
  createServiceClient: () => ({
    auth: { admin: { updateUserById: mockUpdateUserById } },
  }),
}))

import { requireAuth } from '@/lib/auth'
import { PATCH } from './route'

const authedUser = { ok: true as const, userId: 'user-uuid', email: 'user@test.de', role: 'mitarbeiter' }
const unauthResult = { ok: false as const, error: 'Nicht authentifiziert', status: 401 as const }

function makeRequest(body: unknown) {
  return {
    json: () => Promise.resolve(body),
  } as unknown as NextRequest
}

describe('PATCH /api/benutzer/me/passwort', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 zurück ohne Authentifizierung', async () => {
    vi.mocked(requireAuth).mockResolvedValue(unauthResult)
    const res = await PATCH(makeRequest({ aktuelles_passwort: 'alt', neues_passwort: 'passwort123', passwort_bestaetigen: 'passwort123' }))
    expect(res.status).toBe(401)
  })

  it('gibt 400 zurück wenn aktuelles Passwort fehlt', async () => {
    vi.mocked(requireAuth).mockResolvedValue(authedUser)
    const res = await PATCH(makeRequest({ neues_passwort: 'passwort123', passwort_bestaetigen: 'passwort123' }))
    expect(res.status).toBe(400)
  })

  it('gibt 400 zurück wenn neues Passwort unter 8 Zeichen', async () => {
    vi.mocked(requireAuth).mockResolvedValue(authedUser)
    const res = await PATCH(makeRequest({ aktuelles_passwort: 'altPasswort1', neues_passwort: 'kurz', passwort_bestaetigen: 'kurz' }))
    expect(res.status).toBe(400)
  })

  it('gibt 400 zurück wenn Passwörter nicht übereinstimmen', async () => {
    vi.mocked(requireAuth).mockResolvedValue(authedUser)
    const res = await PATCH(makeRequest({
      aktuelles_passwort: 'altPasswort1',
      neues_passwort: 'neuesPasswort1',
      passwort_bestaetigen: 'anderesPasswort1',
    }))
    expect(res.status).toBe(400)
  })

  it('gibt 400 zurück wenn aktuelles Passwort falsch ist', async () => {
    vi.mocked(requireAuth).mockResolvedValue(authedUser)
    mockSignInWithPassword.mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } })

    const res = await PATCH(makeRequest({
      aktuelles_passwort: 'falsesPasswort1',
      neues_passwort: 'neuesPasswort1',
      passwort_bestaetigen: 'neuesPasswort1',
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('nicht korrekt')
  })

  it('ändert Passwort erfolgreich und gibt 200 zurück', async () => {
    vi.mocked(requireAuth).mockResolvedValue(authedUser)
    mockSignInWithPassword.mockResolvedValue({ data: { user: { id: 'user-uuid' } }, error: null })
    mockUpdateUserById.mockResolvedValue({ error: null })

    const res = await PATCH(makeRequest({
      aktuelles_passwort: 'altPasswort1',
      neues_passwort: 'neuesPasswort1',
      passwort_bestaetigen: 'neuesPasswort1',
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(mockUpdateUserById).toHaveBeenCalledWith('user-uuid', { password: 'neuesPasswort1' })
  })

  it('gibt 500 zurück wenn Auth-Update fehlschlägt', async () => {
    vi.mocked(requireAuth).mockResolvedValue(authedUser)
    mockSignInWithPassword.mockResolvedValue({ data: { user: { id: 'user-uuid' } }, error: null })
    mockUpdateUserById.mockResolvedValue({ error: { message: 'Update failed' } })

    const res = await PATCH(makeRequest({
      aktuelles_passwort: 'altPasswort1',
      neues_passwort: 'neuesPasswort1',
      passwort_bestaetigen: 'neuesPasswort1',
    }))
    expect(res.status).toBe(500)
  })
})
