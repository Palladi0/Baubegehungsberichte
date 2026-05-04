import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// PROJ-8: Tests für GET /api/admin/whatsapp/messages

vi.mock('@/lib/auth', () => ({
  requireAdmin: vi.fn(),
}))

const mockSelect = vi.fn()
const mockFrom = vi.fn(() => ({ select: mockSelect }))

vi.mock('@/lib/supabase-service', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}))

import { requireAdmin } from '@/lib/auth'
import { GET } from './route'

const adminAuth = { ok: true as const, userId: 'admin', email: 'a@b.de', role: 'admin' }
const unauthResult = { ok: false as const, error: 'Nicht authentifiziert', status: 401 }
const forbidden = { ok: false as const, error: 'Zugriff verweigert', status: 403 }

function makeReq() {
  return new NextRequest('http://localhost/api/admin/whatsapp/messages')
}

describe('GET /api/admin/whatsapp/messages', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lehnt unautorisierte Anfragen mit 401 ab', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(unauthResult)
    const res = await GET(makeReq())
    expect(res.status).toBe(401)
  })

  it('lehnt Nicht-Admin mit 403 ab', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(forbidden)
    const res = await GET(makeReq())
    expect(res.status).toBe(403)
  })

  it('gibt Liste der Nachrichten zurück (Admin)', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    mockSelect.mockReturnValue({
      order: () => ({
        limit: () =>
          Promise.resolve({
            data: [
              {
                id: '1',
                twilio_message_sid: 'SM1',
                sender_phone: '+4917612345678',
                user_id: 'u1',
                message_type: 'text',
                text_content: 'Test',
                local_file_path: null,
                transcript: null,
                transcript_status: null,
                status: 'stored',
                received_at: new Date().toISOString(),
                processed_at: null,
                error_message: null,
              },
            ],
            error: null,
          }),
      }),
    })

    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Array.isArray(json)).toBe(true)
    expect(json[0].twilio_message_sid).toBe('SM1')
  })

  it('gibt 500 bei DB-Fehler zurück', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    mockSelect.mockReturnValue({
      order: () => ({
        limit: () => Promise.resolve({ data: null, error: { message: 'DB down' } }),
      }),
    })

    const res = await GET(makeReq())
    expect(res.status).toBe(500)
  })

  it('gibt keine sensiblen Felder zurück (kein twilio_media_url)', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(adminAuth)
    mockSelect.mockReturnValue({
      order: () => ({
        limit: () =>
          Promise.resolve({ data: [{ id: '1', sender_phone: '+49' }], error: null }),
      }),
    })

    await GET(makeReq())

    // Verify das Select-Statement keine Twilio-Auth-URLs zurückgibt (sensitive Felder)
    expect(mockFrom).toHaveBeenCalledWith('incoming_messages')
    const selectCall = mockSelect.mock.calls[0][0]
    expect(selectCall).not.toContain('twilio_media_url')
  })
})
