import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase-service'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const TeilnehmerSchema = z.object({
  name: z.string().min(1),
  rolle: z.string().default(''),
})

const BegehungSchema = z.object({
  projekt_id: z.string().uuid(),
  datum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ungültiges Datum'),
  uhrzeit: z.string().regex(/^\d{2}:\d{2}$/, 'Ungültige Uhrzeit'),
  wetterbedingungen: z
    .enum(['Sonnig', 'Bewölkt', 'Regnerisch', 'Schnee', 'Nebel'])
    .nullable()
    .optional(),
  temperatur: z.number().nullable().optional(),
  leistungsstand: z.string().nullable().optional(),
  vorkommnisse: z.string().nullable().optional(),
  massnahmen: z.string().nullable().optional(),
  bemerkungen: z.string().nullable().optional(),
  status: z.enum(['Entwurf', 'Fertig']).default('Entwurf'),
  teilnehmer: z.array(TeilnehmerSchema).default([]),
})

export async function GET(request: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const service = createServiceClient()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const projektId = searchParams.get('projektId')

  let query = service
    .from('begehungen')
    .select(`
      id, datum, uhrzeit, wetterbedingungen, temperatur, status, erstellt_am, aktualisiert_am,
      projekt:projekte(id, name, kuerzel),
      bearbeiter:nutzer_profile(id, email),
      teilnehmer:begehung_teilnehmer(id, name, rolle)
    `)
    .order('datum', { ascending: false })
    .order('uhrzeit', { ascending: false })
    .limit(500)

  if (status) {
    query = query.eq('status', status)
  }

  if (projektId) {
    query = query.eq('projekt_id', projektId)
  }

  if (auth.role !== 'admin') {
    query = query.eq('bearbeiter_id', auth.userId)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 })
  }

  const result = (data ?? []).map((b: Record<string, unknown>) => {
    const projekt = b.projekt as { id: string; name: string; kuerzel: string } | null
    const bearbeiter = b.bearbeiter as { id: string; email: string } | null
    return {
      id: b.id,
      projekt_id: projekt?.id ?? '',
      projekt_name: projekt?.name ?? '',
      projekt_kuerzel: projekt?.kuerzel ?? '',
      bearbeiter_id: bearbeiter?.id ?? '',
      bearbeiter_email: bearbeiter?.email ?? '',
      datum: b.datum,
      uhrzeit: b.uhrzeit,
      wetterbedingungen: b.wetterbedingungen,
      temperatur: b.temperatur,
      status: b.status,
      teilnehmer: b.teilnehmer,
      erstellt_am: b.erstellt_am,
      aktualisiert_am: b.aktualisiert_am,
    }
  })

  return NextResponse.json(result)
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
  }

  const parsed = BegehungSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { teilnehmer, ...begehungDaten } = parsed.data
  const service = createServiceClient()

  // Archivierungs-Check: keine neuen Begehungen für archivierte Projekte
  const { data: projekt } = await service
    .from('projekte')
    .select('archived_at')
    .eq('id', begehungDaten.projekt_id)
    .maybeSingle()

  if (!projekt) {
    return NextResponse.json({ error: 'Projekt nicht gefunden' }, { status: 404 })
  }
  if (projekt.archived_at) {
    return NextResponse.json(
      { error: 'Für archivierte Projekte können keine neuen Begehungen erstellt werden' },
      { status: 422 }
    )
  }

  // Duplikat-Check: gleiches Projekt + Datum existiert bereits?
  const { data: duplikat } = await service
    .from('begehungen')
    .select('id')
    .eq('projekt_id', begehungDaten.projekt_id)
    .eq('datum', begehungDaten.datum)
    .eq('bearbeiter_id', auth.userId)
    .limit(1)
    .maybeSingle()

  const { data: begehung, error } = await service
    .from('begehungen')
    .insert({ ...begehungDaten, bearbeiter_id: auth.userId })
    .select('id')
    .single()

  if (error || !begehung) {
    return NextResponse.json({ error: 'Fehler beim Speichern' }, { status: 500 })
  }

  if (teilnehmer.length > 0) {
    const rows = teilnehmer.map((t) => ({ begehung_id: begehung.id, ...t }))
    const { error: tError } = await service.from('begehung_teilnehmer').insert(rows)
    if (tError) {
      return NextResponse.json({ error: 'Teilnehmer konnten nicht gespeichert werden' }, { status: 500 })
    }
  }

  return NextResponse.json(
    { id: begehung.id, duplikatWarnung: !!duplikat },
    { status: 201 }
  )
}
