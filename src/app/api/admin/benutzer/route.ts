import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase-service'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const createUserSchema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
  rolle: z.enum(['admin', 'mitarbeiter']),
  passwort: z.string().min(8, 'Passwort muss mindestens 8 Zeichen enthalten'),
})

export async function GET(_request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const service = createServiceClient()

  // Hole alle Profile
  const { data: profiles, error: profileError } = await service
    .from('nutzer_profile')
    .select(
      'id, rolle, aktiv, fehlgeschlagene_versuche, gesperrt_bis, zuletzt_eingeloggt_am, erstellt_am'
    )
    .order('erstellt_am', { ascending: false })
    .limit(500)

  if (profileError) {
    return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 })
  }

  // Hole alle Auth-User (für E-Mail)
  const { data: usersData, error: usersError } = await service.auth.admin.listUsers({
    page: 1,
    perPage: 500,
  })

  if (usersError) {
    return NextResponse.json({ error: 'Auth-Fehler' }, { status: 500 })
  }

  const emailById = new Map(usersData.users.map((u) => [u.id, u.email ?? '']))

  const result = (profiles ?? []).map((p) => ({
    id: p.id,
    email: emailById.get(p.id) ?? '',
    rolle: p.rolle,
    aktiv: p.aktiv,
    fehlgeschlagene_versuche: p.fehlgeschlagene_versuche,
    gesperrt_bis: p.gesperrt_bis,
    zuletzt_eingeloggt_am: p.zuletzt_eingeloggt_am,
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

  const parsed = createUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Validierung fehlgeschlagen' },
      { status: 400 }
    )
  }

  const service = createServiceClient()

  const { data: created, error: createError } = await service.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.passwort,
    email_confirm: true,
  })

  if (createError || !created.user) {
    const message = createError?.message?.includes('already')
      ? 'Ein Nutzer mit dieser E-Mail existiert bereits.'
      : 'Nutzer konnte nicht angelegt werden.'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const { error: insertError } = await service.from('nutzer_profile').insert({
    id: created.user.id,
    rolle: parsed.data.rolle,
    aktiv: true,
  })

  if (insertError) {
    // Rollback: lösche den gerade angelegten Auth-User
    await service.auth.admin.deleteUser(created.user.id)
    return NextResponse.json(
      { error: 'Profil konnte nicht angelegt werden.' },
      { status: 500 }
    )
  }

  return NextResponse.json(
    {
      id: created.user.id,
      email: created.user.email,
      rolle: parsed.data.rolle,
      aktiv: true,
    },
    { status: 201 }
  )
}
