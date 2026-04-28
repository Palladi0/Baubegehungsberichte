import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  requireAdmin: vi.fn(),
}))

const mockIn = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase-service', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}))

import { requireAdmin } from '@/lib/auth'
import { GET } from './route'

const adminAuth = { ok: true as const, userId: 'admin-uuid', email: 'admin@test.de', role: 'admin' }
const unauthResult = { ok: false as const, error: 'Nicht authentifiziert', status: 401 }

function makeRequest() {
  return new NextRequest('http://localhost/api/admin/whatsapp/unassigned', {
    headers: { Authorization: 'Bearer token' },
  })
}

function setupSuccessMock(data: unknown) {
  mockIn.mockResolvedValue({ data, error: null })
  mockFrom.mockReturnValue({
    select: () => ({
      in: () => ({
        order: () => ({
          limit: mockIn,
        }),
      }),
    }),
  })
}

describe('GET /api/admin/whatsapp/unassigned', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 zurück ohne Admin-Auth', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(unauthResult)
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it('gibt Liste nicht-zugeordneter Nachrichten zurück', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    const testData = [
      {
        id: 'msg-1',
        sender_phone: '+4917612345678',
        message_type: 'text',
        text_content: 'Bitte zuordnen',
        transcript: null,
        received_at: '2026-04-23T10:00:00Z',
        assignment_status: 'pending',
        clarification_attempts: 0,
      },
    ]
    setupSuccessMock(testData)
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveLength(1)
    expect(json[0].assignment_status).toBe('pending')
  })

  it('gibt leere Liste zurück wenn alle Nachrichten zugeordnet sind', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    setupSuccessMock([])
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveLength(0)
  })

  it('gibt 500 zurück bei Datenbankfehler', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    mockFrom.mockReturnValue({
      select: () => ({
        in: () => ({
          order: () => ({
            limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB-Fehler' } }),
          }),
        }),
      }),
    })
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
  })
})
