import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

const AssignSchema = z.object({
  project_id: z.string().uuid(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request.headers.get('Authorization'))
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null)
  const parsed = AssignSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Eingabe' }, { status: 400 })
  }

  const { id } = await params
  const db = createServiceClient()

  // Prüfe ob Nachricht existiert
  const { data: nachricht } = await db
    .from('incoming_messages')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (!nachricht) {
    return NextResponse.json({ error: 'Nachricht nicht gefunden' }, { status: 404 })
  }

  // Prüfe ob Projekt existiert und aktiv ist
  const { data: projekt } = await db
    .from('projekte')
    .select('id, kuerzel, archived_at')
    .eq('id', parsed.data.project_id)
    .maybeSingle()

  if (!projekt) {
    return NextResponse.json({ error: 'Projekt nicht gefunden' }, { status: 404 })
  }
  if (projekt.archived_at) {
    return NextResponse.json({ error: 'Projekt ist archiviert' }, { status: 422 })
  }

  const { error } = await db
    .from('incoming_messages')
    .update({
      project_id: parsed.data.project_id,
      assignment_status: 'assigned',
      assignment_method: 'manual',
      assigned_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
