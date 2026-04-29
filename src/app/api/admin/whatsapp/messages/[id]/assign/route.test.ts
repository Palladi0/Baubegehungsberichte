import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  requireAdmin: vi.fn(),
}))

const mockNachrichtMaybeSingle = vi.fn()
const mockProjektMaybeSingle = vi.fn()
const mockUpdateEq = vi.fn().mockResolvedValue({ error: null })

const mockFrom = vi.fn((table: string) => {
  if (table === 'incoming_messages') {
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: mockNachrichtMaybeSingle,
        }),
      }),
      update: () => ({ eq: mockUpdateEq }),
    }
  }
  if (table === 'projekte') {
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: mockProjektMaybeSingle,
        }),
      }),
    }
  }
  return {}
})

vi.mock('@/lib/supabase-service', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}))

import { requireAdmin } from '@/lib/auth'
import { POST } from './route'

const adminAuth = { ok: true as const, userId: 'admin-uuid', email: 'admin@test.de', role: 'admin' }
const unauthResult = { ok: false as const, error: 'Nicht authentifiziert', status: 401 }

const validProjectId = '550e8400-e29b-41d4-a716-446655440000'
const validMessageId = '660f8500-f39c-52e5-b827-557766551111'

function makeCtx(id = validMessageId) {
  return { params: Promise.resolve({ id }) }
}

function makeMockRequest(bodyObj: Record<string, unknown> | null = { project_id: validProjectId }): NextRequest {
  return {
    headers: {
      get: (name: string) => (name === 'Authorization' ? 'Bearer token' : null),
    },
    json: bodyObj === null
      ? vi.fn().mockRejectedValue(new Error('Invalid JSON'))
      : vi.fn().mockResolvedValue(bodyObj),
  } as unknown as NextRequest
}

describe('POST /api/admin/whatsapp/messages/[id]/assign', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Standard: Nachricht existiert
    mockNachrichtMaybeSingle.mockResolvedValue({ data: { id: validMessageId } })
    mockUpdateEq.mockResolvedValue({ error: null })
  })

  it('gibt 401 zurück ohne Admin-Auth', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(unauthResult)
    const res = await POST(makeMockRequest(), makeCtx())
    expect(res.status).toBe(401)
  })

  it('gibt 400 zurück bei ungültiger project_id (kein UUID)', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    const res = await POST(makeMockRequest({ project_id: 'kein-uuid' }), makeCtx())
    expect(res.status).toBe(400)
  })

  it('gibt 400 zurück bei fehlendem Body', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    const res = await POST(makeMockRequest(null), makeCtx())
    expect(res.status).toBe(400)
  })

  it('gibt 404 zurück wenn Nachricht nicht existiert (BUG-3 Fix)', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    mockNachrichtMaybeSingle.mockResolvedValue({ data: null })
    const res = await POST(makeMockRequest(), makeCtx())
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toMatch(/nachricht nicht gefunden/i)
  })

  it('gibt 404 zurück wenn Projekt nicht existiert', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    mockProjektMaybeSingle.mockResolvedValue({ data: null })
    const res = await POST(makeMockRequest(), makeCtx())
    expect(res.status).toBe(404)
  })

  it('gibt 422 zurück wenn Projekt archiviert ist', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    mockProjektMaybeSingle.mockResolvedValue({
      data: { id: validProjectId, kuerzel: 'ARCH-01', archived_at: '2025-01-01T00:00:00Z' },
    })
    const res = await POST(makeMockRequest(), makeCtx())
    expect(res.status).toBe(422)
  })

  it('ordnet Nachricht erfolgreich zu (200)', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    mockProjektMaybeSingle.mockResolvedValue({
      data: { id: validProjectId, kuerzel: 'BV-23-Hamburg', archived_at: null },
    })
    const res = await POST(makeMockRequest(), makeCtx())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
  })

  it('setzt assignment_method "manual" und assigned_at beim Update (BUG-4 Fix)', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    mockProjektMaybeSingle.mockResolvedValue({
      data: { id: validProjectId, kuerzel: 'BV-23-Hamburg', archived_at: null },
    })
    const res = await POST(makeMockRequest(), makeCtx())
    expect(res.status).toBe(200)
    // mockFrom wurde für 'incoming_messages' aufgerufen (Existenzcheck + Update)
    expect(mockFrom).toHaveBeenCalledWith('incoming_messages')
  })

  it('gibt 500 zurück bei Datenbankfehler beim Update', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    mockProjektMaybeSingle.mockResolvedValue({
      data: { id: validProjectId, kuerzel: 'BV-23-Hamburg', archived_at: null },
    })
    mockUpdateEq.mockResolvedValue({ error: { message: 'DB-Fehler' } })
    const res = await POST(makeMockRequest(), makeCtx())
    expect(res.status).toBe(500)
  })
})
