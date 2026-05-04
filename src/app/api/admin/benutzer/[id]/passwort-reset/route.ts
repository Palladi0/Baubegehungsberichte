import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase-service'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const resetSchema = z.object({
  neues_passwort: z.string().min(8, 'Passwort muss mindestens 8 Zeichen enthalten'),
})

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

  const parsed = resetSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Validierung fehlgeschlagen' },
      { status: 400 }
    )
  }

  const service = createServiceClient()

  const { error } = await service.auth.admin.updateUserById(id, {
    password: parsed.data.neues_passwort,
  })

  if (error) {
    return NextResponse.json(
      { error: 'Passwort konnte nicht zurückgesetzt werden.' },
      { status: 500 }
    )
  }

  // Beim Passwort-Reset: Fehlversuche & Lockout zurücksetzen
  await service
    .from('nutzer_profile')
    .update({ fehlgeschlagene_versuche: 0, gesperrt_bis: null })
    .eq('id', id)

  return NextResponse.json({ success: true })
}
