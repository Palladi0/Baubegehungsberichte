import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-service'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const service = createServiceClient()

  const { data: projekt } = await service
    .from('projekte')
    .select('id, archived_at')
    .eq('id', id)
    .single()

  if (!projekt) {
    return NextResponse.json({ error: 'Projekt nicht gefunden.' }, { status: 404 })
  }

  if (projekt.archived_at) {
    return NextResponse.json({ error: 'Projekt ist bereits archiviert.' }, { status: 409 })
  }

  const { data, error } = await service
    .from('projekte')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Projekt konnte nicht archiviert werden.' }, { status: 500 })
  }

  return NextResponse.json(data)
}
