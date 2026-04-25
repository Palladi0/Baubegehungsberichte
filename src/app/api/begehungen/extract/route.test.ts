import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockCreate = vi.hoisted(() => vi.fn())

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mockCreate }
  },
}))

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
}))

import { POST } from './route'
import { requireAuth } from '@/lib/auth'

function makeRequest(body: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest
}

function setupAuth() {
  vi.mocked(requireAuth).mockResolvedValue({
    ok: true,
    userId: 'user-1',
    role: 'mitarbeiter',
    email: 'user@test.de',
  } as Awaited<ReturnType<typeof requireAuth>>)
}

beforeEach(() => {
  vi.resetAllMocks()
  setupAuth()
})

describe('POST /api/begehungen/extract', () => {
  it('gibt 429 zurück wenn Rate Limit überschritten (21. Aufruf in einer Stunde)', async () => {
    // Use a dedicated userId so this test does not exhaust the limit for other tests
    vi.mocked(requireAuth).mockResolvedValue({
      ok: true, userId: 'rate-limit-test-user', role: 'mitarbeiter', email: 'rl@test.de',
    } as Awaited<ReturnType<typeof requireAuth>>)

    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: '{}' }] })
    for (let i = 0; i < 20; i++) {
      await POST(makeRequest({ freitext: 'Genug langer Freitext fuer die Extraktion hier' }))
    }
    const res = await POST(makeRequest({ freitext: 'Genug langer Freitext fuer die Extraktion hier' }))
    expect(res.status).toBe(429)
    const json = await res.json()
    expect(json.error).toMatch(/Limit/i)
  })

  it('gibt 401 zurück ohne Auth', async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      ok: false,
      error: 'Nicht authentifiziert',
      status: 401,
    } as Awaited<ReturnType<typeof requireAuth>>)

    const res = await POST(makeRequest({ freitext: 'Testtext mit mehr als zehn Zeichen' }))
    expect(res.status).toBe(401)
  })

  it('gibt 422 zurück bei zu kurzem Text (< 10 Zeichen)', async () => {
    const res = await POST(makeRequest({ freitext: 'kurz' }))
    expect(res.status).toBe(422)
  })

  it('gibt 422 zurück bei fehlendem freitext-Feld', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(422)
  })

  it('gibt 400 zurück bei ungültigem JSON-Body', async () => {
    const req = { json: () => Promise.reject(new SyntaxError('bad json')) } as unknown as NextRequest
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('gibt leerErgebnis zurück wenn KI ein leeres Objekt zurückgibt', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{}' }],
    })

    const res = await POST(makeRequest({ freitext: 'Ein sehr langer Freitext ohne erkennbare Felder hier' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.leerErgebnis).toBe(true)
  })

  it('gibt strukturierte Felder zurück wenn KI Inhalte extrahiert', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            teilnehmer: [{ name: 'Max Mustermann', rolle: 'Bauleiter' }],
            leistungsstand: 'Rohbau 60% fertig',
            vorkommnisse: 'Keine besonderen Vorkommnisse',
            massnahmen: null,
            bemerkungen: null,
          }),
        },
      ],
    })

    const res = await POST(makeRequest({ freitext: 'Begehung mit Max Mustermann als Bauleiter. Rohbau 60% fertig.' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.leerErgebnis).toBe(false)
    expect(json.extraktion.leistungsstand).toBe('Rohbau 60% fertig')
    expect(json.extraktion.teilnehmer).toHaveLength(1)
    expect(json.extraktion.teilnehmer[0].name).toBe('Max Mustermann')
  })

  it('gibt 200 mit leerErgebnis zurück wenn KI ungültiges JSON liefert', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'kein gültiges JSON' }],
    })

    const res = await POST(makeRequest({ freitext: 'Ein sehr langer Freitext ohne erkennbare Felder hier' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.leerErgebnis).toBe(true)
  })

  it('gibt 503 zurück wenn die Claude API einen Fehler wirft', async () => {
    mockCreate.mockRejectedValue(new Error('API Timeout'))

    const res = await POST(makeRequest({ freitext: 'Ein sehr langer Freitext ohne erkennbare Felder hier' }))
    expect(res.status).toBe(503)
  })
})
