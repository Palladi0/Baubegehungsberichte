import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// --- Mocks ---

vi.mock('@/lib/auth', () => ({
  requireAdmin: vi.fn(),
}))

const mockUpdateEq = vi.fn()
const mockSelectOrderLimit = vi.fn()
const mockFrom = vi.fn((table: string) => {
  if (table === 'transcription_jobs') {
    return {
      select: () => ({
        order: () => ({
          limit: mockSelectOrderLimit,
        }),
      }),
    }
  }
  if (table === 'incoming_messages') {
    return {
      update: () => ({
        eq: mockUpdateEq,
      }),
    }
  }
  return {}
})

vi.mock('@/lib/supabase-service', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}))

import { requireAdmin } from '@/lib/auth'
import { GET, PATCH } from './route'

const adminAuth = { ok: true as const, userId: 'admin-uuid', email: 'admin@test.de', role: 'admin' }
const unauthResult = { ok: false as const, error: 'Nicht authentifiziert', status: 401 }

function makeRequest(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/admin/whatsapp/transcription-jobs', {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('GET /api/admin/whatsapp/transcription-jobs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 zurück ohne Admin-Auth', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(unauthResult)
    const res = await GET(makeRequest('GET'))
    expect(res.status).toBe(401)
  })

  it('gibt Job-Liste zurück bei erfolgreicher Abfrage', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    mockSelectOrderLimit.mockResolvedValue({
      data: [
        {
          id: 'job-1',
          status: 'done',
          attempts: 1,
          duration_seconds: 90,
          cost_usd: 0.009,
          last_error: null,
          created_at: '2026-04-23T10:00:00Z',
          updated_at: '2026-04-23T10:01:00Z',
          incoming_messages: { sender_phone: '+4917600000001', transcript_status: 'done' },
        },
      ],
      error: null,
    })
    const res = await GET(makeRequest('GET'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Array.isArray(json)).toBe(true)
    expect(json[0].status).toBe('done')
  })

  it('gibt 500 zurück bei Datenbankfehler', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    mockSelectOrderLimit.mockResolvedValue({
      data: null,
      error: { message: 'connection error' },
    })
    const res = await GET(makeRequest('GET'))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('Datenbankfehler')
  })
})

describe('PATCH /api/admin/whatsapp/transcription-jobs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 zurück ohne Admin-Auth', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(unauthResult)
    const res = await PATCH(makeRequest('PATCH', { incoming_message_id: 'uuid', transcript: 'Text' }))
    expect(res.status).toBe(401)
  })

  it('gibt 400 zurück wenn incoming_message_id fehlt', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    const res = await PATCH(makeRequest('PATCH', { transcript: 'Text' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Ungültige Eingabe')
  })

  it('gibt 400 zurück wenn transcript kein String ist', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    const res = await PATCH(makeRequest('PATCH', { incoming_message_id: 'uuid', transcript: 123 }))
    expect(res.status).toBe(400)
  })

  it('gibt 400 zurück bei leerem Body', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    const req = new NextRequest('http://localhost/api/admin/whatsapp/transcription-jobs', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer token' },
      body: 'invalid-json',
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
  })

  it('aktualisiert Transkript erfolgreich (200)', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    mockUpdateEq.mockResolvedValue({ error: null })
    const res = await PATCH(
      makeRequest('PATCH', {
        incoming_message_id: '550e8400-e29b-41d4-a716-446655440000',
        transcript: 'Korrigierter Transkript-Text',
      })
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
  })

  it('gibt 500 zurück bei Datenbankfehler beim Update', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    mockUpdateEq.mockResolvedValue({ error: { message: 'db error' } })
    const res = await PATCH(
      makeRequest('PATCH', {
        incoming_message_id: '550e8400-e29b-41d4-a716-446655440000',
        transcript: 'Text',
      })
    )
    expect(res.status).toBe(500)
  })

  it('erlaubt leeren String als Transkript (Löschen)', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    mockUpdateEq.mockResolvedValue({ error: null })
    const res = await PATCH(
      makeRequest('PATCH', {
        incoming_message_id: '550e8400-e29b-41d4-a716-446655440000',
        transcript: '',
      })
    )
    expect(res.status).toBe(200)
  })
})
