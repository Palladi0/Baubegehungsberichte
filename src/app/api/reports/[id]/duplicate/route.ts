import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-service'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const service = createServiceClient()

  // Quell-Bericht laden (mit aktueller Version)
  const { data: quelle } = await service
    .from('berichte')
    .select('id, projekt_id, ersteller_id, begehungs_datum, aktuelle_version_nr')
    .eq('id', id)
    .single()

  if (!quelle) {
    return NextResponse.json({ error: 'Bericht nicht gefunden' }, { status: 404 })
  }

  // Zugriffscheck: Mitarbeiter dürfen nur eigene Projekte duplizieren
  if (auth.role !== 'admin') {
    const { data: pm } = await service
      .from('projekt_mitarbeiter')
      .select('nutzer_id')
      .eq('projekt_id', quelle.projekt_id)
      .eq('nutzer_id', auth.userId)
      .maybeSingle()

    if (!pm) {
      return NextResponse.json({ error: 'Zugriff verweigert' }, { status: 403 })
    }
  }

  // Aktuellen Snapshot laden
  const { data: version } = await service
    .from('berichts_versionen')
    .select('inhalt')
    .eq('bericht_id', id)
    .eq('version_nr', quelle.aktuelle_version_nr)
    .single()

  if (!version) {
    return NextResponse.json({ error: 'Berichtsversion nicht gefunden' }, { status: 404 })
  }

  // Neues Datum: Quell-Datum + 1 Tag (als Vorschlag; Eindeutigkeit nicht garantiert)
  const quellDatum = new Date(quelle.begehungs_datum)
  quellDatum.setDate(quellDatum.getDate() + 1)
  const neuesDatum = quellDatum.toISOString().slice(0, 10)

  // Neuen Bericht anlegen
  const { data: neuerBericht, error: berErr } = await service
    .from('berichte')
    .insert({
      projekt_id: quelle.projekt_id,
      ersteller_id: auth.userId,
      begehungs_datum: neuesDatum,
      aktuelle_version_nr: 1,
      status: 'entwurf',
    })
    .select('id')
    .single()

  if (berErr || !neuerBericht) {
    // Postgres unique-constraint-Verletzung: Bericht für diesen Tag existiert bereits
    if (berErr?.code === '23505') {
      return NextResponse.json(
        { error: `Für das Datum ${neuesDatum} existiert bereits ein Bericht für dieses Projekt.` },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: 'Duplikat konnte nicht angelegt werden' },
      { status: 500 }
    )
  }

  // Version kopieren
  const { error: verErr } = await service.from('berichts_versionen').insert({
    bericht_id: neuerBericht.id,
    version_nr: 1,
    inhalt: version.inhalt,
  })

  if (verErr) {
    return NextResponse.json({ error: 'Version konnte nicht kopiert werden' }, { status: 500 })
  }

  return NextResponse.json({ id: neuerBericht.id }, { status: 201 })
}
