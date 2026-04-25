import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ requireAuth: vi.fn() }))

vi.mock('fs/promises', () => {
  const rm = vi.fn().mockResolvedValue(undefined)
  return { default: { rm }, rm }
})

const state = {
  foto: null as Record<string, unknown> | null,
  updateError: null as unknown,
}

vi.mock('@/lib/supabase-service', () => ({
  createServiceClient: () => ({
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({ single: () => Promise.resolve({ data: state.foto, error: null }) }),
      }),
      update: () => ({
        eq: () => Promise.resolve({ error: state.updateError }),
      }),
    })),
  }),
}))

import { requireAuth } from '@/lib/auth'
import { PATCH, DELETE } from './route'

const admin = { ok: true as const, userId: 'a-1', email: 'a@b', role: 'admin' }
const owner = { ok: true as const, userId: 'owner-1', email: 'o@b', role: 'mitarbeiter' }
const other = { ok: true as const, userId: 'other-1', email: 'x@b', role: 'mitarbeiter' }
const unauth = { ok: false as const, error: 'Nicht authentifiziert', status: 401 }

const VALID_ID = '550e8400-e29b-41d4-a716-446655440000'
const ACTIVE_FOTO = { id: VALID_ID, projekt_id: 'proj-1', uploader_id: 'owner-1', datei_endung: 'jpg', geloescht_am: null }
const DELETED_FOTO = { ...ACTIVE_FOTO, geloescht_am: '2026-04-23T12:00:00Z' }

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

function makePatchReq(body: unknown, id = VALID_ID): NextRequest {
  return new NextRequest(`http://localhost/api/media/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeDeleteReq(id = VALID_ID): NextRequest {
  return new NextRequest(`http://localhost/api/media/${id}`, { method: 'DELETE' })
}

// ─── PATCH Tests ────────────────────────────────────────────────────────────

describe('PATCH /api/media/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.foto = null
    state.updateError = null
  })

  it('gibt 401 zurück ohne Authentifizierung', async () => {
    vi.mocked(requireAuth).mockResolvedValue(unauth)
    const res = await PATCH(makePatchReq({}), makeParams(VALID_ID))
    expect(res.status).toBe(401)
  })

  it('gibt 404 zurück wenn Foto nicht existiert', async () => {
    vi.mocked(requireAuth).mockResolvedValue(admin)
    state.foto = null
    const res = await PATCH(makePatchReq({ bildunterschrift: 'Test' }), makeParams(VALID_ID))
    expect(res.status).toBe(404)
  })

  it('gibt 404 zurück wenn Foto bereits gelöscht', async () => {
    vi.mocked(requireAuth).mockResolvedValue(admin)
    state.foto = DELETED_FOTO
    const res = await PATCH(makePatchReq({ bildunterschrift: 'Test' }), makeParams(VALID_ID))
    expect(res.status).toBe(404)
  })

  it('gibt 403 zurück wenn Nutzer weder Eigentümer noch Admin', async () => {
    vi.mocked(requireAuth).mockResolvedValue(other)
    state.foto = ACTIVE_FOTO
    const res = await PATCH(makePatchReq({ bildunterschrift: 'Test' }), makeParams(VALID_ID))
    expect(res.status).toBe(403)
  })

  it('gibt 422 zurück bei Bildunterschrift > 500 Zeichen', async () => {
    vi.mocked(requireAuth).mockResolvedValue(owner)
    state.foto = ACTIVE_FOTO
    const res = await PATCH(makePatchReq({ bildunterschrift: 'x'.repeat(501) }), makeParams(VALID_ID))
    expect(res.status).toBe(422)
  })

  it('Eigentümer kann eigenes Foto aktualisieren (200)', async () => {
    vi.mocked(requireAuth).mockResolvedValue(owner)
    state.foto = ACTIVE_FOTO
    const res = await PATCH(makePatchReq({ bildunterschrift: 'Neue Unterschrift' }), makeParams(VALID_ID))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
  })

  it('Admin kann beliebiges Foto aktualisieren (200)', async () => {
    vi.mocked(requireAuth).mockResolvedValue(admin)
    state.foto = ACTIVE_FOTO
    const res = await PATCH(makePatchReq({ bildunterschrift: 'Admin Änderung', begehung_id: null }), makeParams(VALID_ID))
    expect(res.status).toBe(200)
  })

  it('akzeptiert leere Bildunterschrift (null-Clearing)', async () => {
    vi.mocked(requireAuth).mockResolvedValue(owner)
    state.foto = ACTIVE_FOTO
    const res = await PATCH(makePatchReq({ bildunterschrift: '' }), makeParams(VALID_ID))
    expect(res.status).toBe(200)
  })
})

// ─── DELETE Tests ───────────────────────────────────────────────────────────

describe('DELETE /api/media/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.foto = null
    state.updateError = null
  })

  it('gibt 401 zurück ohne Authentifizierung', async () => {
    vi.mocked(requireAuth).mockResolvedValue(unauth)
    const res = await DELETE(makeDeleteReq(), makeParams(VALID_ID))
    expect(res.status).toBe(401)
  })

  it('gibt 404 zurück wenn Foto nicht existiert', async () => {
    vi.mocked(requireAuth).mockResolvedValue(admin)
    state.foto = null
    const res = await DELETE(makeDeleteReq(), makeParams(VALID_ID))
    expect(res.status).toBe(404)
  })

  it('gibt 404 zurück wenn Foto bereits soft-gelöscht', async () => {
    vi.mocked(requireAuth).mockResolvedValue(admin)
    state.foto = DELETED_FOTO
    const res = await DELETE(makeDeleteReq(), makeParams(VALID_ID))
    expect(res.status).toBe(404)
  })

  it('gibt 403 zurück wenn Nutzer weder Eigentümer noch Admin', async () => {
    vi.mocked(requireAuth).mockResolvedValue(other)
    state.foto = ACTIVE_FOTO
    const res = await DELETE(makeDeleteReq(), makeParams(VALID_ID))
    expect(res.status).toBe(403)
  })

  it('Eigentümer kann eigenes Foto soft-löschen (200)', async () => {
    vi.mocked(requireAuth).mockResolvedValue(owner)
    state.foto = ACTIVE_FOTO
    const res = await DELETE(makeDeleteReq(), makeParams(VALID_ID))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
  })

  it('Admin kann beliebiges Foto soft-löschen (200)', async () => {
    vi.mocked(requireAuth).mockResolvedValue(admin)
    state.foto = ACTIVE_FOTO
    const res = await DELETE(makeDeleteReq(), makeParams(VALID_ID))
    expect(res.status).toBe(200)
  })

  it('gibt 500 zurück bei Datenbankfehler beim Soft-Delete', async () => {
    vi.mocked(requireAuth).mockResolvedValue(admin)
    state.foto = ACTIVE_FOTO
    state.updateError = { message: 'DB error' }
    const res = await DELETE(makeDeleteReq(), makeParams(VALID_ID))
    expect(res.status).toBe(500)
  })
})
