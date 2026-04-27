import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
}))

const state = {
  bericht: null as null | {
    id: string
    status: string
    ersteller_id: string
    projekt_id: string
  },
  updateError: null as null | { message: string },
}

vi.mock('@/lib/supabase-service', () => ({
  createServiceClient: () => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: state.bericht, error: null }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: state.updateError }),
      }),
    })),
  }),
}))

import { requireAuth } from '@/lib/auth'
import { PATCH } from './route'

const adminAuth = { ok: true as const, userId: 'admin-uuid', email: 'admin@ppb.de', role: 'admin' }
const eigentuemerAuth = { ok: true as const, userId: 'user-1', email: 'user@ppb.de', role: 'mitarbeiter' }
const fremderAuth = { ok: true as const, userId: 'user-2', email: 'other@ppb.de', role: 'mitarbeiter' }
const unauth = { ok: false as const, error: 'Nicht authentifiziert', status: 401 as const }

function makePatch(id: string) {
  return [
    new NextRequest(`http://localhost/api/reports/${id}/status`, { method: 'PATCH' }),
    { params: Promise.resolve({ id }) },
  ] as const
}

describe('PATCH /api/reports/[id]/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.bericht = null
    state.updateError = null
  })

  it('gibt 401 zurück wenn nicht authentifiziert', async () => {
    vi.mocked(requireAuth).mockResolvedValue(unauth)
    const [req, ctx] = makePatch('b-1')
    const res = await PATCH(req, ctx)
    expect(res.status).toBe(401)
  })

  it('gibt 404 zurück wenn Bericht nicht existiert', async () => {
    vi.mocked(requireAuth).mockResolvedValue(eigentuemerAuth)
    state.bericht = null
    const [req, ctx] = makePatch('unbekannt')
    const res = await PATCH(req, ctx)
    expect(res.status).toBe(404)
  })

  it('Admin kann Status umschalten', async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminAuth)
    state.bericht = { id: 'b-1', status: 'entwurf', ersteller_id: 'other-user', projekt_id: 'proj-1' }
    const [req, ctx] = makePatch('b-1')
    const res = await PATCH(req, ctx)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('fertig')
  })

  it('Eigentümer kann Status umschalten: fertig → entwurf', async () => {
    vi.mocked(requireAuth).mockResolvedValue(eigentuemerAuth)
    state.bericht = { id: 'b-1', status: 'fertig', ersteller_id: 'user-1', projekt_id: 'proj-1' }
    const [req, ctx] = makePatch('b-1')
    const res = await PATCH(req, ctx)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('entwurf')
  })

  it('Fremder Mitarbeiter (kein Eigentümer) kann Status nicht ändern (403)', async () => {
    vi.mocked(requireAuth).mockResolvedValue(fremderAuth)
    state.bericht = { id: 'b-1', status: 'entwurf', ersteller_id: 'user-1', projekt_id: 'proj-1' }
    const [req, ctx] = makePatch('b-1')
    const res = await PATCH(req, ctx)
    expect(res.status).toBe(403)
  })
})
