import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ requireAuth: vi.fn() }))

const state = {
  mitglied: null as unknown,
  fotos: [] as unknown[],
  dbError: null as unknown,
}

vi.mock('@/lib/supabase-service', () => ({
  createServiceClient: () => ({
    from: vi.fn((tbl: string) => {
      if (tbl === 'projekt_mitarbeiter') {
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ single: () => Promise.resolve({ data: state.mitglied, error: null }) }) }),
          }),
        }
      }
      // fotos
      const chain: Record<string, unknown> = {}
      const self = new Proxy(chain, {
        get: (_t, prop) => {
          if (prop === 'then') {
            return (resolve: (v: unknown) => unknown) =>
              Promise.resolve({ data: state.fotos, error: state.dbError }).then(resolve)
          }
          return () => self
        },
      })
      return { select: () => self }
    }),
  }),
}))

import { requireAuth } from '@/lib/auth'
import { GET } from './route'

const admin = { ok: true as const, userId: 'a-1', email: 'a@b', role: 'admin' }
const mitarbeiter = { ok: true as const, userId: 'u-1', email: 'u@b', role: 'mitarbeiter' }
const unauth = { ok: false as const, error: 'Nicht authentifiziert', status: 401 }

const MOCK_FOTOS = [
  {
    id: 'foto-1',
    projekt_id: 'proj-1',
    begehung_id: null,
    uploader_id: 'u-1',
    original_dateiname: 'IMG_001.jpg',
    datei_endung: 'jpg',
    dateigroesse_original: 1024000,
    bildunterschrift: 'Rohbau Ostseite',
    erstellt_am: '2026-04-23T10:00:00Z',
    aktualisiert_am: '2026-04-23T10:00:00Z',
    uploader: { id: 'u-1', vorname: 'Max', nachname: 'Muster', email: 'max@ppb.de' },
    begehung: null,
  },
]

function makeReq(projektId?: string, extra?: Record<string, string>): NextRequest {
  const params = new URLSearchParams()
  if (projektId) params.set('projektId', projektId)
  Object.entries(extra ?? {}).forEach(([k, v]) => params.set(k, v))
  return new NextRequest(`http://localhost/api/media?${params.toString()}`)
}

describe('GET /api/media', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.mitglied = null
    state.fotos = []
    state.dbError = null
  })

  it('gibt 401 zurück ohne Authentifizierung', async () => {
    vi.mocked(requireAuth).mockResolvedValue(unauth)
    const res = await GET(makeReq('proj-1'))
    expect(res.status).toBe(401)
  })

  it('gibt 400 zurück wenn projektId fehlt', async () => {
    vi.mocked(requireAuth).mockResolvedValue(admin)
    const res = await GET(makeReq())
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/projektId/)
  })

  it('gibt 403 zurück wenn Mitarbeiter kein Projektmitglied', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mitarbeiter)
    state.mitglied = null
    const res = await GET(makeReq('proj-1'))
    expect(res.status).toBe(403)
  })

  it('Admin sieht Fotos ohne Mitgliedschaftsprüfung', async () => {
    vi.mocked(requireAuth).mockResolvedValue(admin)
    state.fotos = MOCK_FOTOS
    const res = await GET(makeReq('proj-1'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveLength(1)
    expect(json[0].id).toBe('foto-1')
  })

  it('Mitarbeiter sieht Fotos mit Projektmitgliedschaft', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mitarbeiter)
    state.mitglied = { nutzer_id: 'u-1' }
    state.fotos = MOCK_FOTOS
    const res = await GET(makeReq('proj-1'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveLength(1)
  })

  it('gibt leere Liste zurück wenn keine Fotos vorhanden', async () => {
    vi.mocked(requireAuth).mockResolvedValue(admin)
    state.fotos = []
    const res = await GET(makeReq('proj-1'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveLength(0)
  })

  it('gibt 500 zurück bei Datenbankfehler', async () => {
    vi.mocked(requireAuth).mockResolvedValue(admin)
    state.dbError = { message: 'DB error' }
    const res = await GET(makeReq('proj-1'))
    expect(res.status).toBe(500)
  })

  it('akzeptiert sort-Parameter ohne Fehler', async () => {
    vi.mocked(requireAuth).mockResolvedValue(admin)
    state.fotos = MOCK_FOTOS
    const res = await GET(makeReq('proj-1', { sort: 'begehung' }))
    expect(res.status).toBe(200)
  })
})
