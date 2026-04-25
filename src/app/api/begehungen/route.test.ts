import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'

vi.mock('@/lib/supabase-service', () => ({
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
}))

import { createServiceClient } from '@/lib/supabase-service'
import { requireAuth } from '@/lib/auth'

const validBody = {
  projekt_id: '550e8400-e29b-41d4-a716-446655440000',
  datum: '2026-04-24',
  uhrzeit: '10:00',
  status: 'Entwurf',
  teilnehmer: [],
}

// NextRequest.json() is non-configurable in jsdom — use a lightweight request stub instead.
function makeRequest(body: unknown) {
  return {
    json: () => Promise.resolve(body),
  } as unknown as NextRequest
}

function makeChain(
  maybeSingleMock: ReturnType<typeof vi.fn>,
  singleMock: ReturnType<typeof vi.fn>,
) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(),
    eq: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    maybeSingle: maybeSingleMock,
    single: singleMock,
  }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.limit.mockReturnValue(chain)
  chain.insert.mockReturnValue(chain)
  return chain
}

function setupSupabaseMock() {
  const maybeSingleMock = vi.fn()
  const singleMock = vi.fn()
  const chain = makeChain(maybeSingleMock, singleMock)

  vi.mocked(createServiceClient).mockReturnValue({
    from: vi.fn().mockReturnValue(chain),
  } as unknown as ReturnType<typeof createServiceClient>)

  return { maybeSingleMock, singleMock }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(requireAuth).mockResolvedValue({
    ok: true,
    userId: 'user-1',
    role: 'mitarbeiter',
  } as Awaited<ReturnType<typeof requireAuth>>)
})

describe('POST /api/begehungen — Archivierungs-Check', () => {
  it('gibt 422 zurück wenn das Projekt archiviert ist', async () => {
    const { maybeSingleMock } = setupSupabaseMock()
    maybeSingleMock.mockResolvedValueOnce({
      data: { archived_at: '2026-01-01T00:00:00Z' },
      error: null,
    })

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(422)
    const json = await res.json()
    expect(json.error).toMatch(/archiviert/i)
  })

  it('gibt 404 zurück wenn das Projekt nicht existiert', async () => {
    const { maybeSingleMock } = setupSupabaseMock()
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null })

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(404)
  })

  it('legt eine Begehung an wenn das Projekt aktiv ist', async () => {
    const { maybeSingleMock, singleMock } = setupSupabaseMock()

    maybeSingleMock
      .mockResolvedValueOnce({ data: { archived_at: null }, error: null }) // Projekt-Check
      .mockResolvedValueOnce({ data: null, error: null }) // Duplikat-Check

    singleMock.mockResolvedValueOnce({ data: { id: 'begehung-1' }, error: null })

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(201)
  })
})
