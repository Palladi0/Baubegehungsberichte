import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
}))

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(false),
    unlinkSync: vi.fn(),
  },
  existsSync: vi.fn().mockReturnValue(false),
  unlinkSync: vi.fn(),
}))

// ─── Supabase mock state ────────────────────────────────────────────────────
const state = {
  bericht: null as null | {
    id: string
    ersteller_id: string
    pdf_pfad: string | null
    projekt_id?: string
  },
  projektMitglied: false,
  deleteError: null as null | { message: string },
}

vi.mock('@/lib/supabase-service', () => ({
  createServiceClient: () => ({
    from: vi.fn((table: string) => {
      if (table === 'berichte') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: state.bericht, error: null }),
            }),
          }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: state.deleteError }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }
      }
      if (table === 'projekt_mitarbeiter') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: state.projektMitglied ? { nutzer_id: 'user-1' } : null,
                  error: null,
                }),
              }),
            }),
          }),
        }
      }
      return {}
    }),
  }),
}))

import { requireAuth } from '@/lib/auth'
import { DELETE } from './route'

const adminAuth = { ok: true as const, userId: 'admin-uuid', email: 'admin@ppb.de', role: 'admin' }
const eigentuemerAuth = { ok: true as const, userId: 'user-1', email: 'user@ppb.de', role: 'mitarbeiter' }
const fremderAuth = { ok: true as const, userId: 'user-2', email: 'other@ppb.de', role: 'mitarbeiter' }
const unauth = { ok: false as const, error: 'Nicht authentifiziert', status: 401 as const }

function makeDelete(id: string) {
  return [
    new NextRequest(`http://localhost/api/reports/${id}`, { method: 'DELETE' }),
    { params: Promise.resolve({ id }) },
  ] as const
}

describe('DELETE /api/reports/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.bericht = null
    state.projektMitglied = false
    state.deleteError = null
  })

  it('gibt 401 zurück wenn nicht authentifiziert', async () => {
    vi.mocked(requireAuth).mockResolvedValue(unauth)
    const [req, ctx] = makeDelete('bericht-1')
    const res = await DELETE(req, ctx)
    expect(res.status).toBe(401)
  })

  it('gibt 404 zurück wenn Bericht nicht existiert', async () => {
    vi.mocked(requireAuth).mockResolvedValue(eigentuemerAuth)
    state.bericht = null
    const [req, ctx] = makeDelete('unbekannt')
    const res = await DELETE(req, ctx)
    expect(res.status).toBe(404)
  })

  it('Admin kann jeden Bericht löschen', async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminAuth)
    state.bericht = { id: 'b-1', ersteller_id: 'other-user', pdf_pfad: null }
    const [req, ctx] = makeDelete('b-1')
    const res = await DELETE(req, ctx)
    expect(res.status).toBe(204)
  })

  it('Eigentümer kann seinen eigenen Bericht löschen', async () => {
    vi.mocked(requireAuth).mockResolvedValue(eigentuemerAuth)
    state.bericht = { id: 'b-1', ersteller_id: 'user-1', pdf_pfad: null }
    const [req, ctx] = makeDelete('b-1')
    const res = await DELETE(req, ctx)
    expect(res.status).toBe(204)
  })

  it('Mitarbeiter kann fremden Bericht nicht löschen (403)', async () => {
    vi.mocked(requireAuth).mockResolvedValue(fremderAuth)
    state.bericht = { id: 'b-1', ersteller_id: 'user-1', pdf_pfad: null }
    const [req, ctx] = makeDelete('b-1')
    const res = await DELETE(req, ctx)
    expect(res.status).toBe(403)
  })

  it('Datenbankfehler beim Löschen gibt 500 zurück', async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminAuth)
    state.bericht = { id: 'b-1', ersteller_id: 'admin-uuid', pdf_pfad: null }
    state.deleteError = { message: 'DB-Fehler' }
    const [req, ctx] = makeDelete('b-1')
    const res = await DELETE(req, ctx)
    expect(res.status).toBe(500)
  })
})
