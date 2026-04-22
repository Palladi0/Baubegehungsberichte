import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// --- Mocks ---

vi.mock('@/lib/auth', () => ({
  requireAdmin: vi.fn(),
}))

const mockSelect = vi.fn()
const mockInsertSelect = vi.fn()
const mockFrom = vi.fn(() => ({
  select: mockSelect,
  insert: vi.fn(() => ({ select: () => ({ single: mockInsertSelect }) })),
}))

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}))

import { requireAdmin } from '@/lib/auth'
import { GET, POST } from './route'

const adminAuth = { ok: true as const, userId: 'admin-uuid', role: 'admin' }
const unauthResult = { ok: false as const, error: 'Nicht authentifiziert', status: 401 }

function makeRequest(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/admin/whatsapp/phone-registrations', {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('GET /api/admin/whatsapp/phone-registrations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 zurück ohne gültige Auth', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(unauthResult)
    const res = await GET(makeRequest('GET'))
    expect(res.status).toBe(401)
  })

  it('gibt Liste der Registrierungen zurück', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    mockSelect.mockReturnValue({
      order: () => ({ limit: () => ({ data: [{ id: '1', phone_number: '+4917600000000' }], error: null }) }),
    })

    const res = await GET(makeRequest('GET'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Array.isArray(json)).toBe(true)
  })
})

describe('POST /api/admin/whatsapp/phone-registrations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 zurück ohne Auth', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(unauthResult)
    const res = await POST(makeRequest('POST', {}))
    expect(res.status).toBe(401)
  })

  it('gibt 400 bei ungültigem Telefonnummer-Format', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    const res = await POST(
      makeRequest('POST', { user_id: 'uuid-ok', phone_number: '017612345678' }) // kein +
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.details?.phone_number).toBeDefined()
  })

  it('erstellt neue Registrierung erfolgreich', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    mockInsertSelect.mockResolvedValue({
      data: { id: 'new-id', phone_number: '+4917612345678', user_id: 'user-1' },
      error: null,
    })

    const res = await POST(
      makeRequest('POST', {
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        phone_number: '+4917612345678',
      })
    )
    expect(res.status).toBe(201)
  })

  it('gibt 409 bei doppelter Telefonnummer', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    mockInsertSelect.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'unique violation' },
    })

    const res = await POST(
      makeRequest('POST', {
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        phone_number: '+4917612345678',
      })
    )
    expect(res.status).toBe(409)
  })
})
