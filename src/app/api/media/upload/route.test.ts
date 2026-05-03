import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({ requireAuth: vi.fn() }))

vi.mock('fs/promises', () => {
  const fns = {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    rm: vi.fn().mockResolvedValue(undefined),
  }
  return { default: fns, ...fns }
})

vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('mock-image')),
  })),
}))

vi.mock('heic-convert', () => ({
  default: vi.fn().mockResolvedValue(new Uint8Array([0xff, 0xd8, 0xff])),
}))

const state = {
  projekt: null as unknown,
  mitglied: null as unknown,
  begehung: null as unknown,
  insertError: null as unknown,
}

vi.mock('@/lib/supabase-service', () => ({
  createServiceClient: () => ({
    from: vi.fn((tbl: string) => {
      if (tbl === 'projekte') {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: state.projekt, error: null }) }) }),
        }
      }
      if (tbl === 'projekt_mitarbeiter') {
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ single: () => Promise.resolve({ data: state.mitglied, error: null }) }) }),
          }),
        }
      }
      if (tbl === 'begehungen') {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: state.begehung, error: null }) }) }),
        }
      }
      // fotos
      return { insert: () => Promise.resolve({ error: state.insertError }) }
    }),
  }),
}))

import { requireAuth } from '@/lib/auth'
import { POST } from './route'

const admin = { ok: true as const, userId: 'a-1', email: 'a@b', role: 'admin' }
const mitarbeiter = { ok: true as const, userId: 'u-1', email: 'u@b', role: 'mitarbeiter' }
const unauth = { ok: false as const, error: 'Nicht authentifiziert', status: 401 }

function makeJpeg(name = 'test.jpg'): File {
  return new File([new Uint8Array(1024)], name, { type: 'image/jpeg' })
}

function fakeSize(file: File, bytes: number): File {
  Object.defineProperty(file, 'size', { value: bytes, configurable: true })
  return file
}

// jsdom doesn't serialize FormData as multipart — spy on formData() directly
function makeReq(files: File[], projektId?: string, begehungId?: string): NextRequest {
  const req = new NextRequest('http://localhost/api/media/upload', { method: 'POST' })
  const fd = new FormData()
  if (projektId) fd.append('projekt_id', projektId)
  if (begehungId) fd.append('begehung_id', begehungId)
  files.forEach((f) => fd.append('files', f))
  vi.spyOn(req, 'formData').mockResolvedValue(fd)
  return req
}

describe('POST /api/media/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.projekt = null
    state.mitglied = null
    state.begehung = null
    state.insertError = null
  })

  it('gibt 401 zurück ohne Authentifizierung', async () => {
    vi.mocked(requireAuth).mockResolvedValue(unauth)
    const res = await POST(makeReq([makeJpeg()], 'proj-1'))
    expect(res.status).toBe(401)
  })

  it('gibt 400 zurück wenn projekt_id fehlt', async () => {
    vi.mocked(requireAuth).mockResolvedValue(admin)
    const res = await POST(makeReq([makeJpeg()]))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/projekt_id/)
  })

  it('gibt 404 zurück wenn Projekt nicht existiert', async () => {
    vi.mocked(requireAuth).mockResolvedValue(admin)
    state.projekt = null
    const res = await POST(makeReq([makeJpeg()], 'nonexistent'))
    expect(res.status).toBe(404)
  })

  it('gibt 403 zurück wenn Mitarbeiter kein Projektmitglied', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mitarbeiter)
    state.projekt = { id: 'proj-1' }
    state.mitglied = null
    const res = await POST(makeReq([makeJpeg()], 'proj-1'))
    expect(res.status).toBe(403)
  })

  it('gibt 400 zurück bei zu vielen Dateien (> 20)', async () => {
    vi.mocked(requireAuth).mockResolvedValue(admin)
    state.projekt = { id: 'proj-1' }
    const files = Array.from({ length: 21 }, (_, i) => makeJpeg(`foto${i}.jpg`))
    const res = await POST(makeReq(files, 'proj-1'))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/20/)
  })

  it('gibt 400 zurück wenn keine Dateien übermittelt', async () => {
    vi.mocked(requireAuth).mockResolvedValue(admin)
    state.projekt = { id: 'proj-1' }
    const res = await POST(makeReq([], 'proj-1'))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/Keine Dateien/)
  })

  it('gibt 207 mit Fehler zurück bei nicht unterstütztem Format', async () => {
    vi.mocked(requireAuth).mockResolvedValue(admin)
    state.projekt = { id: 'proj-1' }
    const gifFile = new File([new Uint8Array(100)], 'test.gif', { type: 'image/gif' })
    const res = await POST(makeReq([gifFile], 'proj-1'))
    expect(res.status).toBe(207)
    const json = await res.json()
    expect(json.fehler[0].error).toMatch(/JPEG, PNG, HEIC/)
  })

  it('gibt 207 mit Fehler zurück bei Datei > 25 MB', async () => {
    vi.mocked(requireAuth).mockResolvedValue(admin)
    state.projekt = { id: 'proj-1' }
    const hugFile = fakeSize(makeJpeg('gross.jpg'), 26 * 1024 * 1024)
    const res = await POST(makeReq([hugFile], 'proj-1'))
    expect(res.status).toBe(207)
    const json = await res.json()
    expect(json.fehler[0].error).toMatch(/25 MB/)
  })

  it('gibt 207 mit hochgeladen zurück bei erfolgreichem Upload (Admin)', async () => {
    vi.mocked(requireAuth).mockResolvedValue(admin)
    state.projekt = { id: 'proj-1' }
    state.insertError = null
    const res = await POST(makeReq([makeJpeg('foto.jpg')], 'proj-1'))
    expect(res.status).toBe(207)
    const json = await res.json()
    expect(json.hochgeladen).toHaveLength(1)
    expect(json.fehler).toHaveLength(0)
  })

  it('gibt 207 mit hochgeladen zurück bei Mitarbeiter mit Projektzugang', async () => {
    vi.mocked(requireAuth).mockResolvedValue(mitarbeiter)
    state.projekt = { id: 'proj-1' }
    state.mitglied = { nutzer_id: 'u-1' }
    state.insertError = null
    const res = await POST(makeReq([makeJpeg('foto.jpg')], 'proj-1'))
    expect(res.status).toBe(207)
    const json = await res.json()
    expect(json.hochgeladen).toHaveLength(1)
  })

  it('behandelt gemischte Dateien (eine gültig, eine ungültig) korrekt', async () => {
    vi.mocked(requireAuth).mockResolvedValue(admin)
    state.projekt = { id: 'proj-1' }
    state.insertError = null
    const valid = makeJpeg('good.jpg')
    const invalid = new File([new Uint8Array(100)], 'bad.gif', { type: 'image/gif' })
    const res = await POST(makeReq([valid, invalid], 'proj-1'))
    expect(res.status).toBe(207)
    const json = await res.json()
    expect(json.hochgeladen).toHaveLength(1)
    expect(json.fehler).toHaveLength(1)
  })

  it('gibt 422 zurück wenn begehung_id zu einem anderen Projekt gehört (BUG-004)', async () => {
    vi.mocked(requireAuth).mockResolvedValue(admin)
    state.projekt = { id: 'proj-1' }
    state.begehung = { projekt_id: 'proj-ANDERS' }
    const res = await POST(makeReq([makeJpeg()], 'proj-1', 'beg-fremdes-projekt'))
    expect(res.status).toBe(422)
    const json = await res.json()
    expect(json.error).toMatch(/Begehung/)
  })

  it('gibt 422 zurück wenn begehung_id nicht existiert (BUG-004)', async () => {
    vi.mocked(requireAuth).mockResolvedValue(admin)
    state.projekt = { id: 'proj-1' }
    state.begehung = null
    const res = await POST(makeReq([makeJpeg()], 'proj-1', 'beg-unbekannt'))
    expect(res.status).toBe(422)
  })

  it('akzeptiert Upload wenn begehung_id zum selben Projekt gehört', async () => {
    vi.mocked(requireAuth).mockResolvedValue(admin)
    state.projekt = { id: 'proj-1' }
    state.begehung = { projekt_id: 'proj-1' }
    state.insertError = null
    const res = await POST(makeReq([makeJpeg()], 'proj-1', 'beg-korrekt'))
    expect(res.status).toBe(207)
    const json = await res.json()
    expect(json.hochgeladen).toHaveLength(1)
  })
})
