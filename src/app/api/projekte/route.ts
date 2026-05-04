import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-service'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const archiviert = searchParams.get('archiviert') === 'true'

  const service = createServiceClient()

  // Admins sehen alle Projekte, Mitarbeiter nur ihre zugeordneten
  if (auth.role === 'admin') {
    let query = service
      .from('projekte')
      .select('id, name, nummer, kuerzel, auftraggeber, adresse, start_datum, end_datum, archived_at')
      .order('erstellt_am', { ascending: false })
      .limit(500)

    query = archiviert
      ? query.not('archived_at', 'is', null)
      : query.is('archived_at', null)

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 })
    }
    return NextResponse.json(data ?? [])
  }

  // Mitarbeiter: nur zugeordnete Projekte
  const { data: pm, error: pmError } = await service
    .from('projekt_mitarbeiter')
    .select('projekt_id')
    .eq('nutzer_id', auth.userId)

  if (pmError) {
    return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 })
  }

  const projektIds = (pm ?? []).map((r: { projekt_id: string }) => r.projekt_id)
  if (projektIds.length === 0) {
    return NextResponse.json([])
  }

  let query = service
    .from('projekte')
    .select('id, name, nummer, kuerzel, auftraggeber, adresse, start_datum, end_datum, archived_at')
    .in('id', projektIds)
    .order('erstellt_am', { ascending: false })
    .limit(500)

  query = archiviert
    ? query.not('archived_at', 'is', null)
    : query.is('archived_at', null)

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
