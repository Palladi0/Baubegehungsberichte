import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  requireAdmin: vi.fn(),
}))

vi.mock('@/lib/transcription-worker', () => ({
  runTranscriptionIteration: vi.fn(),
}))

import { requireAdmin } from '@/lib/auth'
import { runTranscriptionIteration } from '@/lib/transcription-worker'
import { POST } from './route'

const adminAuth = { ok: true as const, userId: 'admin-uuid', email: 'admin@test.de', role: 'admin' }
const unauthResult = { ok: false as const, error: 'Nicht authentifiziert', status: 401 }

function makeRequest() {
  return new NextRequest('http://localhost/api/admin/whatsapp/transcription-worker', {
    method: 'POST',
    headers: { Authorization: 'Bearer token' },
  })
}

describe('POST /api/admin/whatsapp/transcription-worker', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gibt 401 zurück ohne Admin-Auth', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(unauthResult)
    const res = await POST(makeRequest())
    expect(res.status).toBe(401)
    expect(runTranscriptionIteration).not.toHaveBeenCalled()
  })

  it('startet Worker und gibt Ergebnis zurück (200)', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    vi.mocked(runTranscriptionIteration).mockResolvedValue({ processed: 3, failed: 0 })
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.processed).toBe(3)
    expect(json.failed).toBe(0)
  })

  it('gibt Ergebnis mit failed-Zähler zurück wenn Jobs scheitern', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    vi.mocked(runTranscriptionIteration).mockResolvedValue({ processed: 1, failed: 2 })
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.failed).toBe(2)
  })
})
