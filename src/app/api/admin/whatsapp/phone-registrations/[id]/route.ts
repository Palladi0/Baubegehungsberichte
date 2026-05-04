import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-service'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request.headers.get('Authorization'))
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params

  const db = createServiceClient()
  const { error } = await db.from('phone_registrations').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
