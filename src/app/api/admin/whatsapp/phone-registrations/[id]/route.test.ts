import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// PROJ-8: Tests für DELETE /api/admin/whatsapp/phone-registrations/[id]

vi.mock('@/lib/auth', () => ({
  requireAdmin: vi.fn(),
}))

const mockDeleteEq = vi.fn()
const mockFrom = vi.fn(() => ({
  delete: () => ({ eq: mockDeleteEq }),
}))

vi.mock('@/lib/supabase-service', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}))

import { requireAdmin } from '@/lib/auth'
import { DELETE } from './route'

const adminAuth = { ok: true as const, userId: 'a', email: 'a@b.de', role: 'admin' }
const unauth = { ok: false as const, error: 'Nicht authentifiziert', status: 401 }

function makeReq() {
  return new NextRequest('http://localhost/api/admin/whatsapp/phone-registrations/some-id', {
    method: 'DELETE',
  })
}

describe('DELETE /api/admin/whatsapp/phone-registrations/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lehnt unautorisierte Anfragen mit 401 ab', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(unauth)
    const res = await DELETE(makeReq(), { params: Promise.resolve({ id: '123' }) })
    expect(res.status).toBe(401)
  })

  it('löscht Eintrag erfolgreich (204)', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    mockDeleteEq.mockResolvedValue({ error: null })

    const res = await DELETE(makeReq(), { params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }) })
    expect(res.status).toBe(204)
    expect(mockFrom).toHaveBeenCalledWith('phone_registrations')
    expect(mockDeleteEq).toHaveBeenCalledWith('id', '550e8400-e29b-41d4-a716-446655440000')
  })

  it('gibt 500 bei DB-Fehler zurück', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    mockDeleteEq.mockResolvedValue({ error: { message: 'DB error' } })

    const res = await DELETE(makeReq(), { params: Promise.resolve({ id: '123' }) })
    expect(res.status).toBe(500)
  })
})
