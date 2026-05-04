import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
}))

import { GET } from './route'
import { requireAuth } from '@/lib/auth'

function makeRequest(url: string): NextRequest {
  return { url } as unknown as NextRequest
}

function setupAuth() {
  vi.mocked(requireAuth).mockResolvedValue({
    ok: true,
    userId: 'user-1',
    role: 'mitarbeiter',
    email: 'user@test.de',
  } as Awaited<ReturnType<typeof requireAuth>>)
}

function setupUnauth() {
  vi.mocked(requireAuth).mockResolvedValue({
    ok: false,
    error: 'Nicht authentifiziert',
    status: 401,
  } as Awaited<ReturnType<typeof requireAuth>>)
}

const fetchSpy = vi.spyOn(globalThis, 'fetch')

beforeEach(() => {
  vi.resetAllMocks()
  setupAuth()
})

afterEach(() => {
  fetchSpy.mockReset()
})

describe('GET /api/begehungen/wetter — Auth', () => {
  it('gibt 401 zurück ohne Auth', async () => {
    setupUnauth()
    const res = await GET(makeRequest('http://localhost/api/begehungen/wetter?datum=2026-04-24&lat=53.55&lon=9.99'))
    expect(res.status).toBe(401)
  })
})

describe('GET /api/begehungen/wetter — Validierung', () => {
  it('gibt 400 zurück wenn Parameter "datum" fehlt', async () => {
    const res = await GET(makeRequest('http://localhost/api/begehungen/wetter?lat=53.55&lon=9.99'))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/datum/i)
  })

  it('gibt 400 zurück wenn weder lat/lon noch adresse vorhanden', async () => {
    const res = await GET(makeRequest('http://localhost/api/begehungen/wetter?datum=2026-04-24'))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/Koordinaten/i)
  })
})

describe('GET /api/begehungen/wetter — Bright Sky Mapping', () => {
  it('mapt clear → Sonnig', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ weather: [{ condition: 'clear', temperature: 18.3 }] }), { status: 200 })
    )
    const res = await GET(makeRequest('http://localhost/api/begehungen/wetter?datum=2026-04-24&lat=53.55&lon=9.99'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.wetterbedingungen).toBe('Sonnig')
    expect(json.temperatur).toBe(18.3)
  })

  it('mapt cloudy → Bewölkt', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ weather: [{ condition: 'cloudy', temperature: 12 }] }), { status: 200 })
    )
    const res = await GET(makeRequest('http://localhost/api/begehungen/wetter?datum=2026-04-24&lat=53.55&lon=9.99'))
    const json = await res.json()
    expect(json.wetterbedingungen).toBe('Bewölkt')
  })

  it('mapt partly-cloudy → Bewölkt', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ weather: [{ condition: 'partly-cloudy', temperature: 15 }] }), { status: 200 })
    )
    const res = await GET(makeRequest('http://localhost/api/begehungen/wetter?datum=2026-04-24&lat=53.55&lon=9.99'))
    const json = await res.json()
    expect(json.wetterbedingungen).toBe('Bewölkt')
  })

  it('mapt rain → Regnerisch', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ weather: [{ condition: 'rain', temperature: 8 }] }), { status: 200 })
    )
    const res = await GET(makeRequest('http://localhost/api/begehungen/wetter?datum=2026-04-24&lat=53.55&lon=9.99'))
    const json = await res.json()
    expect(json.wetterbedingungen).toBe('Regnerisch')
  })

  it('mapt snow → Schnee', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ weather: [{ condition: 'snow', temperature: -2 }] }), { status: 200 })
    )
    const res = await GET(makeRequest('http://localhost/api/begehungen/wetter?datum=2026-04-24&lat=53.55&lon=9.99'))
    const json = await res.json()
    expect(json.wetterbedingungen).toBe('Schnee')
  })

  it('mapt fog → Nebel', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ weather: [{ condition: 'fog', temperature: 5 }] }), { status: 200 })
    )
    const res = await GET(makeRequest('http://localhost/api/begehungen/wetter?datum=2026-04-24&lat=53.55&lon=9.99'))
    const json = await res.json()
    expect(json.wetterbedingungen).toBe('Nebel')
  })

  it('mapt sleet → Regnerisch', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ weather: [{ condition: 'sleet', temperature: 2 }] }), { status: 200 })
    )
    const res = await GET(makeRequest('http://localhost/api/begehungen/wetter?datum=2026-04-24&lat=53.55&lon=9.99'))
    const json = await res.json()
    expect(json.wetterbedingungen).toBe('Regnerisch')
  })

  it('fällt auf Bewölkt zurück bei unbekannter Bedingung', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ weather: [{ condition: 'thunderstorm', temperature: 16 }] }), { status: 200 })
    )
    const res = await GET(makeRequest('http://localhost/api/begehungen/wetter?datum=2026-04-24&lat=53.55&lon=9.99'))
    const json = await res.json()
    expect(json.wetterbedingungen).toBe('Bewölkt')
  })

  it('rundet Temperatur auf eine Nachkommastelle', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ weather: [{ condition: 'clear', temperature: 18.34567 }] }), { status: 200 })
    )
    const res = await GET(makeRequest('http://localhost/api/begehungen/wetter?datum=2026-04-24&lat=53.55&lon=9.99'))
    const json = await res.json()
    expect(json.temperatur).toBe(18.3)
  })

  it('gibt null zurück wenn Temperatur fehlt', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ weather: [{ condition: 'clear', temperature: null }] }), { status: 200 })
    )
    const res = await GET(makeRequest('http://localhost/api/begehungen/wetter?datum=2026-04-24&lat=53.55&lon=9.99'))
    const json = await res.json()
    expect(json.temperatur).toBeNull()
  })
})

describe('GET /api/begehungen/wetter — Fehlerbehandlung', () => {
  it('gibt 502 zurück wenn Bright Sky API einen Fehler-Status liefert', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('error', { status: 500 }))
    const res = await GET(makeRequest('http://localhost/api/begehungen/wetter?datum=2026-04-24&lat=53.55&lon=9.99'))
    expect(res.status).toBe(502)
  })

  it('gibt 404 zurück wenn keine Wetterdaten gefunden werden', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ weather: [] }), { status: 200 })
    )
    const res = await GET(makeRequest('http://localhost/api/begehungen/wetter?datum=2026-04-24&lat=53.55&lon=9.99'))
    expect(res.status).toBe(404)
  })

  it('gibt 503 zurück wenn fetch wirft (Timeout/Netzwerk)', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('Network timeout'))
    const res = await GET(makeRequest('http://localhost/api/begehungen/wetter?datum=2026-04-24&lat=53.55&lon=9.99'))
    expect(res.status).toBe(503)
  })
})

describe('GET /api/begehungen/wetter — Geocodierung', () => {
  it('geocodiert Adresse via Nominatim wenn lat/lon fehlen', async () => {
    // First call: Nominatim
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify([{ lat: '53.55', lon: '9.99' }]),
        { status: 200 }
      )
    )
    // Second call: Bright Sky
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ weather: [{ condition: 'clear', temperature: 18 }] }), { status: 200 })
    )

    const res = await GET(
      makeRequest('http://localhost/api/begehungen/wetter?datum=2026-04-24&adresse=Hauptstrasse%201,%20Hamburg')
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.wetterbedingungen).toBe('Sonnig')

    // Verify Nominatim was called with the address
    const firstCall = fetchSpy.mock.calls[0][0] as string
    expect(firstCall).toContain('nominatim.openstreetmap.org')
    expect(firstCall).toContain('Hauptstrasse')
  })

  it('gibt 400 zurück wenn Geocodierung fehlschlägt', async () => {
    // Nominatim returns empty
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200 })
    )

    const res = await GET(
      makeRequest('http://localhost/api/begehungen/wetter?datum=2026-04-24&adresse=Unbekannt')
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/Koordinaten/i)
  })
})
