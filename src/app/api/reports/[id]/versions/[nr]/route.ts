import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-service'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; nr: string }> }
) {
  const auth = await requireAuth()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id, nr } = await params
  const versionNr = parseInt(nr, 10)
  if (isNaN(versionNr) || versionNr < 1) {
    return NextResponse.json({ error: 'Ungültige Versionsnummer' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: bericht } = await service
    .from('berichte')
    .select('projekt_id')
    .eq('id', id)
    .single()

  if (!bericht) {
    return NextResponse.json({ error: 'Bericht nicht gefunden' }, { status: 404 })
  }

  if (auth.role !== 'admin') {
    const { data: pm } = await service
      .from('projekt_mitarbeiter')
      .select('nutzer_id')
      .eq('projekt_id', bericht.projekt_id)
      .eq('nutzer_id', auth.userId)
      .maybeSingle()

    if (!pm) {
      return NextResponse.json({ error: 'Zugriff verweigert' }, { status: 403 })
    }
  }

  const { data, error } = await service
    .from('berichts_versionen')
    .select('id, version_nr, erstellt_am, inhalt')
    .eq('bericht_id', id)
    .eq('version_nr', versionNr)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Version nicht gefunden' }, { status: 404 })
  }

  return NextResponse.json(data)
}
