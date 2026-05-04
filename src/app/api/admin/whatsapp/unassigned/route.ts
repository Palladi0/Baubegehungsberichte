import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request.headers.get('Authorization'))
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from('incoming_messages')
    .select(
      'id, sender_phone, message_type, text_content, transcript, received_at, assignment_status, clarification_attempts'
    )
    .in('assignment_status', ['pending', 'awaiting_clarification', 'manual_required', 'failed'])
    .order('received_at', { ascending: false })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 })
  }

  return NextResponse.json(data)
}
