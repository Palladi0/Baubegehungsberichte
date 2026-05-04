import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase-service'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const addSchema = z.object({
  nutzer_id: z.string().uuid('Ungültige Nutzer-ID'),
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

  const { data: pm, error } = await service
    .from('projekt_mitarbeiter')
    .select('nutzer_id, erstellt_am')
    .eq('projekt_id', id)

  if (error) {
    return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 })
  }

  const ids = (pm ?? []).map((r: { nutzer_id: string }) => r.nutzer_id)
  if (ids.length === 0) {
    return NextResponse.json([])
  }

  const { data: profiles } = await service
    .from('nutzer_profile')
    .select('id, rolle, aktiv')
    .in('id', ids)

  const { data: usersData } = await service.auth.admin.listUsers({ page: 1, perPage: 500 })
  const emailById = new Map(
    (usersData?.users ?? []).map((u) => [u.id, u.email ?? ''])
  )

  const result = (profiles ?? []).map((p) => ({
    id: p.id,
    email: emailById.get(p.id) ?? '',
    rolle: p.rolle,
    aktiv: p.aktiv,
    hinzugefuegt_am: pm?.find((r: { nutzer_id: string }) => r.nutzer_id === p.id)?.erstellt_am ?? null,
  }))

  return NextResponse.json(result)
}

export async function POST(
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

  const parsed = addSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Validierung fehlgeschlagen' },
      { status: 400 }
    )
  }

  const service = createServiceClient()

  const { error } = await service
    .from('projekt_mitarbeiter')
    .insert({ projekt_id: id, nutzer_id: parsed.data.nutzer_id })

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Mitarbeiter ist dem Projekt bereits zugeordnet.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: 'Mitarbeiter konnte nicht hinzugefügt werden.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
