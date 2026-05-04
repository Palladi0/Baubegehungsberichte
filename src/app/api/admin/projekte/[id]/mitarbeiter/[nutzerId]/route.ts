import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-service'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; nutzerId: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id, nutzerId } = await params
  const service = createServiceClient()

  const { error } = await service
    .from('projekt_mitarbeiter')
    .delete()
    .eq('projekt_id', id)
    .eq('nutzer_id', nutzerId)

  if (error) {
    return NextResponse.json({ error: 'Mitarbeiter konnte nicht entfernt werden.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
