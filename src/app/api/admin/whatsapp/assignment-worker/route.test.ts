import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  requireAdmin: vi.fn(),
}))

vi.mock('@/lib/assignment-worker', () => ({
  runAssignmentWorker: vi.fn(),
}))

import { requireAdmin } from '@/lib/auth'
import { runAssignmentWorker } from '@/lib/assignment-worker'
import { POST } from './route'

const adminAuth = { ok: true as const, userId: 'admin-uuid', email: 'admin@test.de', role: 'admin' }
const unauthResult = { ok: false as const, error: 'Nicht authentifiziert', status: 401 }

function makeRequest() {
  return new NextRequest('http://localhost/api/admin/whatsapp/assignment-worker', {
    method: 'POST',
    headers: { Authorization: 'Bearer token' },
  })
}

describe('POST /api/admin/whatsapp/assignment-worker', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 zurück ohne Admin-Auth', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(unauthResult)
    const res = await POST(makeRequest())
    expect(res.status).toBe(401)
    expect(runAssignmentWorker).not.toHaveBeenCalled()
  })

  it('startet Worker und gibt Ergebnis zurück (200)', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    vi.mocked(runAssignmentWorker).mockResolvedValue({ processed: 5, failed: 0 })
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.processed).toBe(5)
    expect(json.failed).toBe(0)
  })

  it('gibt Ergebnis mit failed-Zähler zurück wenn Jobs scheitern', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    vi.mocked(runAssignmentWorker).mockResolvedValue({ processed: 2, failed: 3 })
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.failed).toBe(3)
  })

  it('gibt 200 zurück wenn kein Job vorhanden (processed=0)', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    vi.mocked(runAssignmentWorker).mockResolvedValue({ processed: 0, failed: 0 })
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.processed).toBe(0)
  })
})
