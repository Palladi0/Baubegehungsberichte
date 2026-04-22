import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth'

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
      'id, twilio_message_sid, sender_phone, user_id, message_type, text_content, local_file_path, status, received_at, processed_at, error_message'
    )
    .order('received_at', { ascending: false })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 })
  }

  return NextResponse.json(data)
}
