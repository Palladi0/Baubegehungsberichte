import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase-service'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  nummer: z.string().min(1).max(50).optional(),
  kuerzel: z
    .string()
    .min(1)
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, 'Nur Buchstaben, Zahlen und Bindestriche erlaubt')
    .optional(),
  auftraggeber: z.string().max(200).optional().nullable(),
  bauherr: z.string().max(200).optional().nullable(),
  adresse: z.string().max(500).optional().nullable(),
  start_datum: z.string().date().optional().nullable(),
  end_datum: z.string().date().optional().nullable(),
  beschreibung: z.string().max(2000).optional().nullable(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const service = createServiceClient()

  const { data, error } = await service
    .from('projekte')
    .select(
      `id, name, nummer, kuerzel, auftraggeber, bauherr, adresse,
       start_datum, end_datum, beschreibung, archived_at, erstellt_am, aktualisiert_am,
       projekt_mitarbeiter(nutzer_id)`
    )
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Projekt nicht gefunden.' }, { status: 404 })
  }

  // Mitarbeiter-IDs mit E-Mails anreichern
  const mitarbeiterIds = (data.projekt_mitarbeiter ?? []).map(
    (pm: { nutzer_id: string }) => pm.nutzer_id
  )

  let mitarbeiter: { id: string; email: string; rolle: string }[] = []
  if (mitarbeiterIds.length > 0) {
    const { data: profiles } = await service
      .from('nutzer_profile')
      .select('id, rolle')
      .in('id', mitarbeiterIds)

    const { data: usersData } = await service.auth.admin.listUsers({ page: 1, perPage: 500 })
    const emailById = new Map(
      (usersData?.users ?? []).map((u) => [u.id, u.email ?? ''])
    )

    mitarbeiter = (profiles ?? []).map((p) => ({
      id: p.id,
      email: emailById.get(p.id) ?? '',
      rolle: p.rolle,
    }))
  }

  return NextResponse.json({
    ...data,
    projekt_mitarbeiter: undefined,
    mitarbeiter,
  })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 })
  }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Validierung fehlgeschlagen' },
      { status: 400 }
    )
  }

  const service = createServiceClient()

  // Archivierte Projekte dürfen nicht bearbeitet werden
  const { data: existing } = await service
    .from('projekte')
    .select('archived_at')
    .eq('id', id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Projekt nicht gefunden.' }, { status: 404 })
  }

  if (existing.archived_at) {
    return NextResponse.json(
      { error: 'Archivierte Projekte können nicht bearbeitet werden.' },
      { status: 409 }
    )
  }

  // Wenn Kürzel geändert wird: Eindeutigkeit prüfen
  if (parsed.data.kuerzel) {
    const { data: existing } = await service
      .from('projekte')
      .select('id')
      .ilike('kuerzel', parsed.data.kuerzel)
      .neq('id', id)
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: 'Ein Projekt mit diesem Kürzel existiert bereits.' },
        { status: 409 }
      )
    }
  }

  const updateData: Record<string, unknown> = { ...parsed.data }
  if (updateData.kuerzel) {
    updateData.kuerzel = (updateData.kuerzel as string).toUpperCase()
  }

  const { data, error } = await service
    .from('projekte')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Projekt konnte nicht aktualisiert werden.' }, { status: 500 })
  }

  return NextResponse.json(data)
}
