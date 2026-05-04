import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// PROJ-8: Tests für POST /api/admin/whatsapp/worker (manueller Trigger)

vi.mock('@/lib/auth', () => ({
  requireAdmin: vi.fn(),
}))

vi.mock('@/lib/media-worker', () => ({
  runWorkerIteration: vi.fn(),
}))

import { requireAdmin } from '@/lib/auth'
import { runWorkerIteration } from '@/lib/media-worker'
import { POST } from './route'

const adminAuth = { ok: true as const, userId: 'a', email: 'a@b.de', role: 'admin' }
const unauthorized = { ok: false as const, error: 'Nicht authentifiziert', status: 401 }
const forbidden = { ok: false as const, error: 'Zugriff verweigert', status: 403 }

function makeReq() {
  return new NextRequest('http://localhost/api/admin/whatsapp/worker', { method: 'POST' })
}

describe('POST /api/admin/whatsapp/worker', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lehnt unautorisierte Anfragen mit 401 ab', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(unauthorized)
    const res = await POST(makeReq())
    expect(res.status).toBe(401)
    expect(runWorkerIteration).not.toHaveBeenCalled()
  })

  it('lehnt Nicht-Admin mit 403 ab', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(forbidden)
    const res = await POST(makeReq())
    expect(res.status).toBe(403)
    expect(runWorkerIteration).not.toHaveBeenCalled()
  })

  it('führt Worker-Iteration aus und gibt Resultat zurück', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    vi.mocked(runWorkerIteration).mockResolvedValue({ processed: 3, failed: 1 })

    const res = await POST(makeReq())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ processed: 3, failed: 1 })
    expect(runWorkerIteration).toHaveBeenCalledTimes(1)
  })
})
