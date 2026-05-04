import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
}))

// ─── Supabase mock state ────────────────────────────────────────────────────
const state = {
  quelle: null as null | {
    id: string
    projekt_id: string
    ersteller_id: string
    begehungs_datum: string
    aktuelle_version_nr: number
  },
  projektMitglied: false,
  version: null as null | { inhalt: unknown },
  insertBerichtError: null as null | { code?: string; message: string },
  insertVersionError: null as null | { message: string },
  newId: 'b-neu',
}

vi.mock('@/lib/supabase-service', () => ({
  createServiceClient: () => ({
    from: vi.fn((table: string) => {
      if (table === 'berichte') {
        return {
          // SELECT for source bericht
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: state.quelle, error: null }),
            }),
          }),
          // INSERT for new bericht
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: state.insertBerichtError ? null : { id: state.newId },
                error: state.insertBerichtError,
              }),
            }),
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
      if (table === 'berichts_versionen') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: state.version, error: null }),
              }),
            }),
          }),
          insert: vi.fn().mockResolvedValue({ error: state.insertVersionError }),
        }
      }
      return {}
    }),
  }),
}))

import { requireAuth } from '@/lib/auth'
import { POST } from './route'

const adminAuth = { ok: true as const, userId: 'admin-uuid', email: 'admin@ppb.de', role: 'admin' }
const mitarbeiterAuth = {
  ok: true as const,
  userId: 'user-1',
  email: 'user@ppb.de',
  role: 'mitarbeiter',
}
const fremderAuth = {
  ok: true as const,
  userId: 'user-99',
  email: 'fremd@ppb.de',
  role: 'mitarbeiter',
}
const unauth = { ok: false as const, error: 'Nicht authentifiziert', status: 401 as const }

function makePost(id: string) {
  return [
    new NextRequest(`http://localhost/api/reports/${id}/duplicate`, { method: 'POST' }),
    { params: Promise.resolve({ id }) },
  ] as const
}

describe('POST /api/reports/[id]/duplicate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.quelle = null
    state.projektMitglied = false
    state.version = null
    state.insertBerichtError = null
    state.insertVersionError = null
  })

  it('gibt 401 zurück wenn nicht authentifiziert', async () => {
    vi.mocked(requireAuth).mockResolvedValue(unauth)
    const [req, ctx] = makePost('b-1')
    const res = await POST(req, ctx)
    expect(res.status).toBe(401)
  })

  it('gibt 404 zurück wenn Quell-Bericht nicht existiert', async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminAuth)
    state.quelle = null
    const [req, ctx] = makePost('unbekannt')
    const res = await POST(req, ctx)
    expect(res.status).toBe(404)
  })

  it('Mitarbeiter ohne Projektmitgliedschaft bekommt 403 (IDOR-Schutz)', async () => {
    vi.mocked(requireAuth).mockResolvedValue(fremderAuth)
    state.quelle = {
      id: 'b-1',
      projekt_id: 'proj-99',
      ersteller_id: 'user-1',
      begehungs_datum: '2026-04-01',
      aktuelle_version_nr: 1,
    }
    state.projektMitglied = false
    const [req, ctx] = makePost('b-1')
    const res = await POST(req, ctx)
    expect(res.status).toBe(403)
  })

  it('Admin kann fremden Bericht duplizieren (kein Projekt-Check)', async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminAuth)
    state.quelle = {
      id: 'b-1',
      projekt_id: 'proj-1',
      ersteller_id: 'other-user',
      begehungs_datum: '2026-04-01',
      aktuelle_version_nr: 2,
    }
    state.version = { inhalt: { deckblatt: {}, abschnitte: [] } }
    state.newId = 'b-neu-admin'
    const [req, ctx] = makePost('b-1')
    const res = await POST(req, ctx)
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.id).toBe('b-neu-admin')
  })

  it('Mitarbeiter mit Projektmitgliedschaft kann duplizieren', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mitarbeiterAuth)
    state.quelle = {
      id: 'b-1',
      projekt_id: 'proj-1',
      ersteller_id: 'user-1',
      begehungs_datum: '2026-04-01',
      aktuelle_version_nr: 1,
    }
    state.projektMitglied = true
    state.version = { inhalt: { deckblatt: {}, abschnitte: [] } }
    state.newId = 'b-dupliziert'
    const [req, ctx] = makePost('b-1')
    const res = await POST(req, ctx)
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.id).toBe('b-dupliziert')
  })

  it('gibt 409 zurück wenn ein Bericht für das Datum (= +1 Tag) bereits existiert', async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminAuth)
    state.quelle = {
      id: 'b-1',
      projekt_id: 'proj-1',
      ersteller_id: 'user-1',
      begehungs_datum: '2026-04-01',
      aktuelle_version_nr: 1,
    }
    state.version = { inhalt: { deckblatt: {}, abschnitte: [] } }
    state.insertBerichtError = { code: '23505', message: 'unique violation' }
    const [req, ctx] = makePost('b-1')
    const res = await POST(req, ctx)
    expect(res.status).toBe(409)
  })

  it('gibt 404 zurück wenn aktuelle Berichts-Version nicht gefunden', async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminAuth)
    state.quelle = {
      id: 'b-1',
      projekt_id: 'proj-1',
      ersteller_id: 'user-1',
      begehungs_datum: '2026-04-01',
      aktuelle_version_nr: 1,
    }
    state.version = null
    const [req, ctx] = makePost('b-1')
    const res = await POST(req, ctx)
    expect(res.status).toBe(404)
  })
})
