import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
}))

// ─── Supabase mock state ────────────────────────────────────────────────────
const state = {
  projektMitarbeiter: [] as Array<{ projekt_id: string }>,
  berichte: [] as Array<Record<string, unknown>>,
  berichtsCount: 0,
}

// Each call to createServiceClient().from() dispatches to the right stub.
vi.mock('@/lib/supabase-service', () => ({
  createServiceClient: () => ({
    from: vi.fn((table: string) => {
      if (table === 'projekt_mitarbeiter') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: state.projektMitarbeiter,
              error: null,
            }),
          }),
        }
      }

      if (table === 'projekte') {
        // Suche: returns empty → triggers early return in search path
        return {
          select: vi.fn().mockReturnValue({
            ilike: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }
      }

      if (table === 'berichte') {
        // Chainable query that terminates on range()
        const q: Record<string, unknown> = {}
        const chain = () => q
        q.select = vi.fn(() => q)
        q.eq = vi.fn(() => q)
        q.in = vi.fn(() => q)
        q.gte = vi.fn(() => q)
        q.lte = vi.fn(() => q)
        q.order = vi.fn(() => q)
        q.range = vi.fn().mockResolvedValue({
          data: state.berichte,
          count: state.berichtsCount,
          error: null,
        })
        return q
      }

      if (table === 'begehungen') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        }
      }

      // fotos — not reached when begehungen returns empty
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      }
    }),
  }),
}))

import { requireAuth } from '@/lib/auth'
import { GET } from './route'

const adminAuth = {
  ok: true as const,
  userId: 'admin-uuid',
  email: 'admin@ppb.de',
  role: 'admin',
}
const mitarbeiterAuth = {
  ok: true as const,
  userId: 'user-1',
  email: 'user@ppb.de',
  role: 'mitarbeiter',
}
const unauth = { ok: false as const, error: 'Nicht authentifiziert', status: 401 as const }

function makeGet(url = 'http://localhost/api/reports') {
  return new NextRequest(url, { method: 'GET' })
}

describe('GET /api/reports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.projektMitarbeiter = []
    state.berichte = []
    state.berichtsCount = 0
  })

  it('gibt 401 zurück wenn nicht authentifiziert', async () => {
    vi.mocked(requireAuth).mockResolvedValue(unauth)
    const res = await GET(makeGet())
    expect(res.status).toBe(401)
  })

  it('gibt leere Liste zurück wenn Mitarbeiter keine Projekte hat', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mitarbeiterAuth)
    state.projektMitarbeiter = []
    const res = await GET(makeGet())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.berichte).toEqual([])
    expect(json.gesamt).toBe(0)
  })

  it('Admin erhält Berichte ohne Projekt-Filter', async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminAuth)
    state.berichte = [
      {
        id: 'b-1',
        projekt_id: 'proj-1',
        begehungs_datum: '2026-04-01',
        status: 'entwurf',
        aktuelle_version_nr: 1,
        pdf_pfad: null,
        pdf_generiert_am: null,
        pdf_versions_nr: null,
        erstellt_am: '2026-04-01T10:00:00Z',
        aktualisiert_am: '2026-04-01T10:00:00Z',
        ersteller_id: 'user-1',
        projekt: { id: 'proj-1', name: 'Projekt A', nummer: '001' },
        ersteller: { id: 'user-1', email: 'user@ppb.de' },
      },
    ]
    state.berichtsCount = 1
    const res = await GET(makeGet())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.berichte).toHaveLength(1)
    expect(json.berichte[0].projekt_name).toBe('Projekt A')
    expect(json.gesamt).toBe(1)
  })

  it('Mitarbeiter erhält Berichte aus seinen Projekten', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mitarbeiterAuth)
    state.projektMitarbeiter = [{ projekt_id: 'proj-1' }]
    state.berichte = [
      {
        id: 'b-2',
        projekt_id: 'proj-1',
        begehungs_datum: '2026-04-01',
        status: 'fertig',
        aktuelle_version_nr: 2,
        pdf_pfad: '/uploads/b-2.pdf',
        pdf_generiert_am: '2026-04-02T08:00:00Z',
        pdf_versions_nr: 2,
        erstellt_am: '2026-04-01T10:00:00Z',
        aktualisiert_am: '2026-04-02T08:00:00Z',
        ersteller_id: 'user-1',
        projekt: { id: 'proj-1', name: 'Projekt A', nummer: '001' },
        ersteller: { id: 'user-1', email: 'user@ppb.de' },
      },
    ]
    state.berichtsCount = 1
    const res = await GET(makeGet())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.berichte).toHaveLength(1)
    expect(json.berichte[0].status).toBe('fertig')
  })

  it('Antwort enthält alle Pflichtfelder pro Bericht', async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminAuth)
    state.berichte = [
      {
        id: 'b-3',
        projekt_id: 'proj-1',
        begehungs_datum: '2026-04-10',
        status: 'entwurf',
        aktuelle_version_nr: 1,
        pdf_pfad: null,
        pdf_generiert_am: null,
        pdf_versions_nr: null,
        erstellt_am: '2026-04-10T10:00:00Z',
        aktualisiert_am: '2026-04-10T10:00:00Z',
        ersteller_id: 'user-1',
        projekt: { id: 'proj-1', name: 'Muster GmbH', nummer: 'BV-26-001' },
        ersteller: { id: 'user-1', email: 'muster@ppb.de' },
      },
    ]
    state.berichtsCount = 1
    const res = await GET(makeGet())
    const json = await res.json()
    const bericht = json.berichte[0]
    expect(bericht).toHaveProperty('id')
    expect(bericht).toHaveProperty('projekt_name')
    expect(bericht).toHaveProperty('projekt_nummer')
    expect(bericht).toHaveProperty('ersteller_email')
    expect(bericht).toHaveProperty('begehungs_datum')
    expect(bericht).toHaveProperty('status')
    expect(bericht).toHaveProperty('foto_anzahl')
    expect(bericht).toHaveProperty('erstellt_am')
    expect(bericht).toHaveProperty('pdf_pfad')
  })

  it('paginierung: seiten wird korrekt berechnet (25 Einträge/Seite)', async () => {
    vi.mocked(requireAuth).mockResolvedValue(adminAuth)
    state.berichte = []
    state.berichtsCount = 60
    const res = await GET(makeGet())
    const json = await res.json()
    expect(json.seiten).toBe(3) // ceil(60/25) = 3
    expect(json.gesamt).toBe(60)
  })

  // ─── Security: IDOR-Test ──────────────────────────────────────────────────
  // BUG-1: Wenn ein Mitarbeiter projekt_id einer fremden Projekts übergibt, wird
  // die erlaubteProjektIds-Prüfung umgangen, da der Code bei gesetztem `projektId`
  // direkt `eq('projekt_id', projektId)` anwendet ohne zu prüfen, ob die ID in
  // erlaubteProjektIds enthalten ist.
  it('[BUG-1] Mitarbeiter kann nicht auf Berichte fremder Projekte zugreifen (IDOR)', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mitarbeiterAuth)
    // Nutzer ist nur in proj-1 – übergibt aber proj-99 (fremdes Projekt)
    state.projektMitarbeiter = [{ projekt_id: 'proj-1' }]
    state.berichte = [
      {
        id: 'b-fremde',
        projekt_id: 'proj-99',
        begehungs_datum: '2026-04-01',
        status: 'fertig',
        aktuelle_version_nr: 1,
        pdf_pfad: null,
        pdf_generiert_am: null,
        pdf_versions_nr: null,
        erstellt_am: '2026-04-01T10:00:00Z',
        aktualisiert_am: '2026-04-01T10:00:00Z',
        ersteller_id: 'other-user',
        projekt: { id: 'proj-99', name: 'Fremdes Projekt', nummer: '999' },
        ersteller: { id: 'other-user', email: 'other@ppb.de' },
      },
    ]
    state.berichtsCount = 1

    const res = await GET(
      makeGet('http://localhost/api/reports?projekt_id=proj-99')
    )
    const json = await res.json()
    // Sollte leer sein (Zugriff verweigert) — aktuell ist dies ein Bug:
    // die API gibt fälschlicherweise die fremden Berichte zurück.
    expect(json.berichte).toHaveLength(0)
  })
})
