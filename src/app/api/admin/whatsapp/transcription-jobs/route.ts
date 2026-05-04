import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase-service'
import { requireAdmin } from '@/lib/auth'

const PatchSchema = z.object({
  incoming_message_id: z.string().uuid(),
  transcript: z.string().max(50_000),
})

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request.headers.get('Authorization'))
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from('transcription_jobs')
    .select(
      `id, status, attempts, duration_seconds, cost_usd, last_error, created_at, updated_at,
       incoming_messages(sender_phone, transcript_status)`
    )
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 })
  }

  return NextResponse.json(data)
}

// Transkript eines Eintrags bearbeiten (editierbar in der Web-App)
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request.headers.get('Authorization'))
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const raw = await request.json().catch(() => null)
  const parsed = PatchSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Eingabe' }, { status: 400 })
  }
  const { incoming_message_id, transcript } = parsed.data

  const db = createServiceClient()
  const { error } = await db
    .from('incoming_messages')
    .update({ transcript })
    .eq('id', incoming_message_id)

  if (error) {
    return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
