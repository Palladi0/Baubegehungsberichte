import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  requireAdmin: vi.fn(),
}))

const mockUpdateUserById = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase-service', () => ({
  createServiceClient: () => ({
    auth: { admin: { updateUserById: mockUpdateUserById } },
    from: mockFrom,
  }),
}))

import { requireAdmin } from '@/lib/auth'
import { POST } from './route'

const adminAuth = { ok: true as const, userId: 'admin-uuid', email: 'admin@test.de', role: 'admin' }
const unauthResult = { ok: false as const, error: 'Nicht authentifiziert', status: 401 as const }

function makeRequest(body: unknown) {
  return {
    json: () => Promise.resolve(body),
  } as unknown as NextRequest
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('POST /api/admin/benutzer/[id]/passwort-reset', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 zurück ohne Admin-Auth', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(unauthResult)
    const res = await POST(makeRequest({ neues_passwort: 'neuesPasswort1' }), makeParams('user-id'))
    expect(res.status).toBe(401)
  })

  it('gibt 400 zurück bei Passwort kürzer als 8 Zeichen', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    const res = await POST(makeRequest({ neues_passwort: 'kurz' }), makeParams('user-id'))
    expect(res.status).toBe(400)
  })

  it('gibt 400 zurück bei fehlendem Passwort', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    const res = await POST(makeRequest({}), makeParams('user-id'))
    expect(res.status).toBe(400)
  })

  it('setzt Passwort zurück und gibt 200 zurück', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    mockUpdateUserById.mockResolvedValue({ error: null })

    const updateChain = {
      update: vi.fn(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    updateChain.update.mockReturnValue(updateChain)
    mockFrom.mockReturnValue(updateChain)

    const res = await POST(makeRequest({ neues_passwort: 'neuesPasswort1' }), makeParams('user-id'))
    expect(res.status).toBe(200)
    expect(mockUpdateUserById).toHaveBeenCalledWith('user-id', { password: 'neuesPasswort1' })
  })

  it('setzt Fehlversuche und Lockout nach Passwort-Reset zurück', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    mockUpdateUserById.mockResolvedValue({ error: null })

    const updateChain = {
      update: vi.fn(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    updateChain.update.mockReturnValue(updateChain)
    mockFrom.mockReturnValue(updateChain)

    await POST(makeRequest({ neues_passwort: 'neuesPasswort1' }), makeParams('user-id'))

    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ fehlgeschlagene_versuche: 0, gesperrt_bis: null })
    )
  })

  it('gibt 500 zurück wenn Auth-Update fehlschlägt', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    mockUpdateUserById.mockResolvedValue({ error: { message: 'Update failed' } })

    const res = await POST(makeRequest({ neues_passwort: 'neuesPasswort1' }), makeParams('user-id'))
    expect(res.status).toBe(500)
  })
})
