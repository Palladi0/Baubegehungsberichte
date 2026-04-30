import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  requireAdmin: vi.fn(),
}))

const mockSingle = vi.fn()
const mockEq = vi.fn()
const mockNeq = vi.fn()
const mockSelect = vi.fn()
const mockUpdate = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase-service', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}))

import { requireAdmin } from '@/lib/auth'
import { PUT } from './route'

const adminAuth = { ok: true as const, userId: 'admin-uuid', email: 'admin@test.de', role: 'admin' }
const unauthResult = { ok: false as const, error: 'Nicht authentifiziert', status: 401 as const }

function makeRequest(id: string) {
  return new NextRequest(`http://localhost/api/templates/${id}/default`, { method: 'PUT' })
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('PUT /api/templates/[id]/default', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 ohne Admin-Auth zurück', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(unauthResult)
    const res = await PUT(makeRequest('tpl-1'), makeParams('tpl-1'))
    expect(res.status).toBe(401)
  })

  it('gibt 404 für unbekannte ID zurück', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    mockSingle.mockResolvedValue({ data: null, error: null })
    mockEq.mockReturnValue({ single: mockSingle })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })

    const res = await PUT(makeRequest('unknown'), makeParams('unknown'))
    expect(res.status).toBe(404)
  })

  it('setzt Template als Standard und alle anderen auf false (200)', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)

    mockSingle.mockResolvedValue({ data: { id: 'tpl-2' }, error: null })
    mockEq.mockReturnValue({ single: mockSingle })
    mockSelect.mockReturnValue({ eq: mockEq })

    const mockResetNeq = vi.fn().mockResolvedValue({ error: null })
    const mockResetUpdate = vi.fn().mockReturnValue({ neq: mockResetNeq })

    const mockSetEq = vi.fn().mockResolvedValue({ error: null })
    const mockSetUpdate = vi.fn().mockReturnValue({ eq: mockSetEq })

    let updateCallCount = 0
    mockFrom.mockImplementation(() => ({
      select: mockSelect,
      update: () => {
        updateCallCount++
        if (updateCallCount === 1) return { neq: mockResetNeq }
        return { eq: mockSetEq }
      },
    }))

    const res = await PUT(makeRequest('tpl-2'), makeParams('tpl-2'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
  })
})
