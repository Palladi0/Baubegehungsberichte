import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase-service'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const TeilnehmerSchema = z.object({
  name: z.string().min(1).max(200),
  rolle: z.string().max(100).default(''),
})

const BegehungUpdateSchema = z.object({
  projekt_id: z.string().uuid().optional(),
  datum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  uhrzeit: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  wetterbedingungen: z
    .enum(['Sonnig', 'Bewölkt', 'Regnerisch', 'Schnee', 'Nebel'])
    .nullable()
    .optional(),
  temperatur: z.number().nullable().optional(),
  leistungsstand: z.string().max(10_000).nullable().optional(),
  vorkommnisse: z.string().max(10_000).nullable().optional(),
  massnahmen: z.string().max(10_000).nullable().optional(),
  bemerkungen: z.string().max(10_000).nullable().optional(),
  status: z.enum(['Entwurf', 'Fertig']).optional(),
  teilnehmer: z.array(TeilnehmerSchema).optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const service = createServiceClient()

  const { data, error } = await service
    .from('begehungen')
    .select(`
      id, datum, uhrzeit, wetterbedingungen, temperatur,
      leistungsstand, vorkommnisse, massnahmen, bemerkungen,
      status, erstellt_am, aktualisiert_am,
      projekt:projekte(id, name, kuerzel),
      bearbeiter:nutzer_profile(id, email),
      teilnehmer:begehung_teilnehmer(id, name, rolle)
    `)
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Begehung nicht gefunden' }, { status: 404 })
  }

  const d = data as Record<string, unknown>
  if (auth.role !== 'admin') {
    const bearbeiter = d.bearbeiter as { id: string } | null
    if (bearbeiter?.id !== auth.userId) {
      return NextResponse.json({ error: 'Zugriff verweigert' }, { status: 403 })
    }
  }

  const projekt = d.projekt as { id: string; name: string; kuerzel: string } | null
  const bearbeiter = d.bearbeiter as { id: string; email: string } | null

  return NextResponse.json({
    id: d.id,
    projekt_id: projekt?.id ?? '',
    projekt_name: projekt?.name ?? '',
    projekt_kuerzel: projekt?.kuerzel ?? '',
    bearbeiter_id: bearbeiter?.id ?? '',
    bearbeiter_email: bearbeiter?.email ?? '',
    datum: d.datum,
    uhrzeit: d.uhrzeit,
    wetterbedingungen: d.wetterbedingungen,
    temperatur: d.temperatur,
    leistungsstand: d.leistungsstand,
    vorkommnisse: d.vorkommnisse,
    massnahmen: d.massnahmen,
    bemerkungen: d.bemerkungen,
    status: d.status,
    teilnehmer: d.teilnehmer,
    erstellt_am: d.erstellt_am,
    aktualisiert_am: d.aktualisiert_am,
  })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
  }

  const parsed = BegehungUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { teilnehmer, ...updateDaten } = parsed.data
  const service = createServiceClient()

  const { data: existing, error: findError } = await service
    .from('begehungen')
    .select('id, bearbeiter_id')
    .eq('id', id)
    .single()

  if (findError || !existing) {
    return NextResponse.json({ error: 'Begehung nicht gefunden' }, { status: 404 })
  }

  const ex = existing as { id: string; bearbeiter_id: string }
  if (auth.role !== 'admin' && ex.bearbeiter_id !== auth.userId) {
    return NextResponse.json({ error: 'Zugriff verweigert' }, { status: 403 })
  }

  if (updateDaten.projekt_id) {
    const { data: projekt } = await service
      .from('projekte')
      .select('archived_at')
      .eq('id', updateDaten.projekt_id)
      .maybeSingle()

    if (!projekt) {
      return NextResponse.json({ error: 'Projekt nicht gefunden' }, { status: 404 })
    }
    if (projekt.archived_at) {
      return NextResponse.json(
        { error: 'Für archivierte Projekte können keine Begehungen gespeichert werden' },
        { status: 422 }
      )
    }
  }

  if (Object.keys(updateDaten).length > 0) {
    const { error: updateError } = await service
      .from('begehungen')
      .update(updateDaten)
      .eq('id', id)

    if (updateError) {
      return NextResponse.json({ error: 'Fehler beim Aktualisieren' }, { status: 500 })
    }
  }

  if (teilnehmer !== undefined) {
    await service.from('begehung_teilnehmer').delete().eq('begehung_id', id)

    if (teilnehmer.length > 0) {
      const rows = teilnehmer.map((t) => ({ begehung_id: id, ...t }))
      const { error: tError } = await service.from('begehung_teilnehmer').insert(rows)
      if (tError) {
        return NextResponse.json({ error: 'Teilnehmer konnten nicht gespeichert werden' }, { status: 500 })
      }
    }
  }

  return NextResponse.json({ id })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const service = createServiceClient()

  const { data: existing } = await service
    .from('begehungen')
    .select('id, bearbeiter_id')
    .eq('id', id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Begehung nicht gefunden' }, { status: 404 })
  }

  const ex = existing as { id: string; bearbeiter_id: string }
  if (auth.role !== 'admin' && ex.bearbeiter_id !== auth.userId) {
    return NextResponse.json({ error: 'Zugriff verweigert' }, { status: 403 })
  }

  const { error } = await service.from('begehungen').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ error: 'Fehler beim Löschen' }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
