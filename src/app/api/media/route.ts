import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const projektId = searchParams.get('projektId')
  const begehungId = searchParams.get('begehungId')
  const sortierung = searchParams.get('sort') ?? 'upload'

  if (!projektId) {
    return NextResponse.json({ error: 'projektId ist erforderlich.' }, { status: 400 })
  }

  const service = createServiceClient()

  // Access check for non-admins
  if (auth.role !== 'admin') {
    const { data: mitglied } = await service
      .from('projekt_mitarbeiter')
      .select('nutzer_id')
      .eq('projekt_id', projektId)
      .eq('nutzer_id', auth.userId)
      .single()

    if (!mitglied) {
      return NextResponse.json({ error: 'Kein Zugriff auf dieses Projekt.' }, { status: 403 })
    }
  }

  let query = service
    .from('fotos')
    .select(`
      id,
      projekt_id,
      begehung_id,
      uploader_id,
      original_dateiname,
      datei_endung,
      dateigroesse_original,
      bildunterschrift,
      erstellt_am,
      aktualisiert_am,
      uploader:nutzer_profile(id, vorname, nachname, email),
      begehung:begehungen(id, datum, uhrzeit)
    `)
    .eq('projekt_id', projektId)
    .is('geloescht_am', null)

  if (begehungId) {
    query = query.eq('begehung_id', begehungId)
  }

  // Immer nach erstellt_am vorfiltern; Begehungsdatum-Sortierung läuft in JS (joined field)
  query = query.order('erstellt_am', { ascending: false }).limit(500)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Fotos konnten nicht geladen werden.' }, { status: 500 })
  }

  let ergebnis = data ?? []

  if (sortierung === 'begehung') {
    ergebnis = [...ergebnis].sort((a, b) => {
      // Supabase gibt Many-to-One-Joins als einzelnes Objekt zurück (kein Array)
      const beg = (x: typeof a) => x.begehung as unknown as { datum: string } | null
      const daA = beg(a)?.datum ?? ''
      const daB = beg(b)?.datum ?? ''
      if (daB !== daA) return daB.localeCompare(daA)
      return b.erstellt_am.localeCompare(a.erstellt_am)
    })
  }

  return NextResponse.json(ergebnis)
}
