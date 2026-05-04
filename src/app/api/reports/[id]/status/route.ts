import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-service'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const service = createServiceClient()

  const { data: bericht } = await service
    .from('berichte')
    .select('id, status, ersteller_id, projekt_id')
    .eq('id', id)
    .single()

  if (!bericht) {
    return NextResponse.json({ error: 'Bericht nicht gefunden' }, { status: 404 })
  }

  // Nur Admin oder Ersteller dürfen Status ändern
  if (auth.role !== 'admin' && bericht.ersteller_id !== auth.userId) {
    return NextResponse.json({ error: 'Zugriff verweigert' }, { status: 403 })
  }

  const neuerStatus = bericht.status === 'fertig' ? 'entwurf' : 'fertig'

  const { error } = await service
    .from('berichte')
    .update({ status: neuerStatus })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'Status konnte nicht aktualisiert werden' }, { status: 500 })
  }

  return NextResponse.json({ status: neuerStatus })
}
