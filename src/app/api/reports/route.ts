import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-service'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const SEITE_GROESSE = 25

export async function GET(request: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const projektId = searchParams.get('projekt_id') ?? searchParams.get('projektId')
  const von = searchParams.get('von')
  const bis = searchParams.get('bis')
  const statusFilter = searchParams.get('status')
  const suche = searchParams.get('suche')
  const seite = Math.max(1, parseInt(searchParams.get('seite') ?? '1', 10))
  const sortierung = searchParams.get('sortierung') ?? 'datum_desc'

  const service = createServiceClient()

  // Zugriffsfilter für Mitarbeiter: nur eigene Projekte (BUG-1: immer erzwingen)
  let erlaubteProjektIds: string[] | null = null
  if (auth.role !== 'admin') {
    const { data: pm } = await service
      .from('projekt_mitarbeiter')
      .select('projekt_id')
      .eq('nutzer_id', auth.userId)
    erlaubteProjektIds = (pm ?? []).map((p) => p.projekt_id)
    if (erlaubteProjektIds.length === 0) {
      return NextResponse.json({ berichte: [], gesamt: 0, seiten: 0 })
    }
  }

  // Basis-Query
  let query = service
    .from('berichte')
    .select(
      `
      id, projekt_id, begehungs_datum, status, aktuelle_version_nr,
      pdf_pfad, pdf_generiert_am, pdf_versions_nr, erstellt_am, aktualisiert_am,
      ersteller_id,
      projekt:projekte(id, name, nummer),
      ersteller:nutzer_profile(id, email)
    `,
      { count: 'exact' }
    )

  // Projekt-Filter (BUG-1: erlaubteProjektIds immer als Obergrenze anwenden)
  if (projektId) {
    if (erlaubteProjektIds !== null && !erlaubteProjektIds.includes(projektId)) {
      return NextResponse.json({ berichte: [], gesamt: 0, seiten: 0 })
    }
    query = query.eq('projekt_id', projektId)
  } else if (erlaubteProjektIds !== null) {
    query = query.in('projekt_id', erlaubteProjektIds)
  }

  // Datumsfilter
  if (von) query = query.gte('begehungs_datum', von)
  if (bis) query = query.lte('begehungs_datum', bis)

  // Statusfilter
  if (statusFilter === 'entwurf' || statusFilter === 'fertig') {
    query = query.eq('status', statusFilter)
  }

  // Suche: Projektname ODER Begehungsdatum (BUG-2)
  if (suche && suche.trim()) {
    const term = suche.trim().replace(/[,()*]/g, '')

    // Projekte mit passendem Namen innerhalb erlaubter IDs finden
    let nameProjektQuery = service.from('projekte').select('id').ilike('name', `%${term}%`).limit(200)
    if (erlaubteProjektIds !== null) {
      nameProjektQuery = nameProjektQuery.in('id', erlaubteProjektIds)
    }
    const { data: nameProjekte } = await nameProjektQuery
    const nameProjektIds = (nameProjekte ?? []).map((p) => p.id)

    if (nameProjektIds.length > 0) {
      // OR: entweder Projektname trifft oder Datum enthält Suchbegriff
      query = query.or(
        `projekt_id.in.(${nameProjektIds.join(',')}),begehungs_datum.ilike.*${term}*`
      )
    } else {
      // Kein Projekt passt → nur noch Datum suchen
      query = query.ilike('begehungs_datum', `%${term}%`)
    }
  }

  // Sortierung (BUG-6: Projekt nach Name sortieren via referencedTable)
  switch (sortierung) {
    case 'datum_asc':
      query = query.order('begehungs_datum', { ascending: true })
      break
    case 'erstellt_asc':
      query = query.order('erstellt_am', { ascending: true })
      break
    case 'projekt':
      query = query.order('name', { referencedTable: 'projekte', ascending: true })
      break
    case 'ersteller':
      query = query.order('email', { referencedTable: 'nutzer_profile', ascending: true })
      break
    default:
      query = query.order('begehungs_datum', { ascending: false })
  }

  // Paginierung
  const offset = (seite - 1) * SEITE_GROESSE
  query = query.range(offset, offset + SEITE_GROESSE - 1)

  const { data, count, error } = await query
  if (error) {
    return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 })
  }

  const rows = data ?? []
  const gesamt = count ?? 0
  const seiten = Math.ceil(gesamt / SEITE_GROESSE)

  // Foto-Anzahl berechnen: begehungen → fotos
  let fotosByProjektDatum: Record<string, number> = {}
  if (rows.length > 0) {
    const projektIds = [...new Set(rows.map((b) => b.projekt_id as string))]
    const daten = [...new Set(rows.map((b) => b.begehungs_datum as string))]

    const { data: begehungen } = await service
      .from('begehungen')
      .select('id, projekt_id, datum')
      .in('projekt_id', projektIds)
      .in('datum', daten)
      .limit(500)

    const begehungIds = (begehungen ?? []).map((b) => b.id)
    if (begehungIds.length > 0) {
      const { data: fotoRows } = await service
        .from('fotos')
        .select('begehung_id')
        .in('begehung_id', begehungIds)
        .is('geloescht_am', null)
        .limit(5000)

      const fotosByBegehung: Record<string, number> = {}
      for (const f of fotoRows ?? []) {
        fotosByBegehung[f.begehung_id] = (fotosByBegehung[f.begehung_id] ?? 0) + 1
      }

      for (const beg of begehungen ?? []) {
        const key = `${beg.projekt_id}|${beg.datum}`
        fotosByProjektDatum[key] =
          (fotosByProjektDatum[key] ?? 0) + (fotosByBegehung[beg.id] ?? 0)
      }
    }
  }

  const berichte = rows.map((b: Record<string, unknown>) => {
    const projekt = b.projekt as { id: string; name: string; nummer: string } | null
    const ersteller = b.ersteller as { id: string; email: string } | null
    const key = `${b.projekt_id}|${b.begehungs_datum}`
    return {
      id: b.id,
      projekt_id: b.projekt_id,
      projekt_name: (Array.isArray(projekt) ? projekt[0]?.name : projekt?.name) ?? '',
      projekt_nummer: (Array.isArray(projekt) ? projekt[0]?.nummer : projekt?.nummer) ?? '',
      ersteller_id: b.ersteller_id,
      ersteller_email: (Array.isArray(ersteller) ? ersteller[0]?.email : ersteller?.email) ?? '',
      begehungs_datum: b.begehungs_datum,
      status: (b.status as string) ?? 'entwurf',
      foto_anzahl: fotosByProjektDatum[key] ?? 0,
      aktuelle_version_nr: b.aktuelle_version_nr,
      pdf_pfad: b.pdf_pfad ?? null,
      pdf_generiert_am: b.pdf_generiert_am ?? null,
      pdf_versions_nr: b.pdf_versions_nr ?? null,
      erstellt_am: b.erstellt_am,
      aktualisiert_am: b.aktualisiert_am,
    }
  })

  return NextResponse.json({ berichte, gesamt, seiten })
}
