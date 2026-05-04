import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase-service'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const patchSchema = z
  .object({
    rolle: z.enum(['admin', 'mitarbeiter']).optional(),
    aktiv: z.boolean().optional(),
  })
  .refine((v) => v.rolle !== undefined || v.aktiv !== undefined, {
    message: 'Mindestens ein Feld (rolle oder aktiv) muss angegeben werden.',
  })

export async function PATCH(
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

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Validierung fehlgeschlagen' },
      { status: 400 }
    )
  }

  // Guard: eigener Account darf nicht deaktiviert werden
  if (parsed.data.aktiv === false && id === auth.userId) {
    return NextResponse.json(
      { error: 'Der eigene Account kann nicht deaktiviert werden.' },
      { status: 400 }
    )
  }

  const service = createServiceClient()

  const update: Record<string, unknown> = {}
  if (parsed.data.rolle !== undefined) update.rolle = parsed.data.rolle
  if (parsed.data.aktiv !== undefined) {
    update.aktiv = parsed.data.aktiv
    if (parsed.data.aktiv === true) {
      // Beim Reaktivieren: Lockout & Fehlversuche zurücksetzen
      update.fehlgeschlagene_versuche = 0
      update.gesperrt_bis = null
    }
  }

  const { data, error } = await service
    .from('nutzer_profile')
    .update(update)
    .eq('id', id)
    .select('id, rolle, aktiv, fehlgeschlagene_versuche, gesperrt_bis')
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: 'Nutzer konnte nicht aktualisiert werden.' },
      { status: 500 }
    )
  }

  return NextResponse.json(data)
}
