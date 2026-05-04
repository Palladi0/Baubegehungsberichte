import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase-service'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const projektSchema = z.object({
  name: z.string().min(1, 'Projektname ist erforderlich').max(200),
  nummer: z.string().min(1, 'Projektnummer ist erforderlich').max(50),
  kuerzel: z
    .string()
    .min(1, 'Projektkürzel ist erforderlich')
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, 'Nur Buchstaben, Zahlen und Bindestriche erlaubt'),
  auftraggeber: z.string().max(200).optional().nullable(),
  bauherr: z.string().max(200).optional().nullable(),
  adresse: z.string().max(500).optional().nullable(),
  start_datum: z.string().date().optional().nullable(),
  end_datum: z.string().date().optional().nullable(),
  beschreibung: z.string().max(2000).optional().nullable(),
})

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const archiviert = searchParams.get('archiviert') === 'true'

  const service = createServiceClient()

  let query = service
    .from('projekte')
    .select(
      `id, name, nummer, kuerzel, auftraggeber, bauherr, adresse,
       start_datum, end_datum, beschreibung, archived_at, erstellt_am, aktualisiert_am,
       projekt_mitarbeiter(nutzer_id)`
    )
    .order('erstellt_am', { ascending: false })
    .limit(500)

  if (archiviert) {
    query = query.not('archived_at', 'is', null)
  } else {
    query = query.is('archived_at', null)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 })
  }

  const result = (data ?? []).map((p) => ({
    ...p,
    mitarbeiter_anzahl: p.projekt_mitarbeiter?.length ?? 0,
    projekt_mitarbeiter: undefined,
  }))

  return NextResponse.json(result)
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 })
  }

  const parsed = projektSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Validierung fehlgeschlagen' },
      { status: 400 }
    )
  }

  const service = createServiceClient()

  // Kürzel-Eindeutigkeitsprüfung (case-insensitive)
  const { data: existing } = await service
    .from('projekte')
    .select('id')
    .ilike('kuerzel', parsed.data.kuerzel)
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: 'Ein Projekt mit diesem Kürzel existiert bereits.' },
      { status: 409 }
    )
  }

  const { data, error } = await service
    .from('projekte')
    .insert({
      name: parsed.data.name,
      nummer: parsed.data.nummer,
      kuerzel: parsed.data.kuerzel.toUpperCase(),
      auftraggeber: parsed.data.auftraggeber ?? null,
      bauherr: parsed.data.bauherr ?? null,
      adresse: parsed.data.adresse ?? null,
      start_datum: parsed.data.start_datum ?? null,
      end_datum: parsed.data.end_datum ?? null,
      beschreibung: parsed.data.beschreibung ?? null,
    })
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Projekt konnte nicht angelegt werden.' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
