import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import type { Wetterbedingung } from '@/components/begehungen/types'

export const dynamic = 'force-dynamic'

type BrightSkyCondition =
  | 'clear'
  | 'cloudy'
  | 'partly-cloudy'
  | 'rain'
  | 'sleet'
  | 'snow'
  | 'fog'
  | string

function mapCondition(condition: BrightSkyCondition): Wetterbedingung {
  switch (condition) {
    case 'clear': return 'Sonnig'
    case 'cloudy':
    case 'partly-cloudy': return 'Bewölkt'
    case 'rain':
    case 'sleet': return 'Regnerisch'
    case 'snow': return 'Schnee'
    case 'fog': return 'Nebel'
    default: return 'Bewölkt'
  }
}

async function geocodeAdresse(adresse: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(adresse)}&format=json&limit=1`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Baubegehungsberichte/1.0' },
      signal: AbortSignal.timeout(5000),
    })
    const data = await res.json()
    if (Array.isArray(data) && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }
    }
  } catch {
    // Geocodierung fehlgeschlagen
  }
  return null
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  let lat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : null
  let lon = searchParams.get('lon') ? parseFloat(searchParams.get('lon')!) : null
  const adresse = searchParams.get('adresse')
  const datum = searchParams.get('datum')
  const uhrzeit = searchParams.get('uhrzeit') ?? '12:00'

  if (!datum) {
    return NextResponse.json({ error: 'Parameter "datum" fehlt' }, { status: 400 })
  }

  // Geocodieren falls lat/lon fehlt aber Adresse vorhanden
  if ((lat === null || lon === null) && adresse) {
    const coords = await geocodeAdresse(adresse)
    if (coords) {
      lat = coords.lat
      lon = coords.lon
    }
  }

  if (lat === null || lon === null) {
    return NextResponse.json({ error: 'Koordinaten nicht verfügbar' }, { status: 400 })
  }

  try {
    const datetime = `${datum}T${uhrzeit}:00`
    const url = `https://api.brightsky.dev/weather?lat=${lat}&lon=${lon}&date=${datetime}&last_date=${datetime}&timezone=Europe/Berlin`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })

    if (!res.ok) {
      return NextResponse.json({ error: 'Bright Sky API nicht erreichbar' }, { status: 502 })
    }

    const data = await res.json()
    const wetter = Array.isArray(data.weather) && data.weather.length > 0 ? data.weather[0] : null

    if (!wetter) {
      return NextResponse.json({ error: 'Keine Wetterdaten für diesen Zeitpunkt' }, { status: 404 })
    }

    return NextResponse.json({
      wetterbedingungen: mapCondition(wetter.condition ?? ''),
      temperatur: wetter.temperature != null ? Math.round(wetter.temperature * 10) / 10 : null,
    })
  } catch {
    return NextResponse.json({ error: 'Wetterabruf fehlgeschlagen' }, { status: 503 })
  }
}
