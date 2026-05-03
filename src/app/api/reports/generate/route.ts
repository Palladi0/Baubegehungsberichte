import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase-service'
import { requireAuth } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import type { BerichtsSnapshot } from '@/types/berichte'

export const dynamic = 'force-dynamic'

const GenerateSchema = z.object({
  projekt_id: z.string().uuid(),
  datum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ungültiges Datum'),
})

export async function POST(request: NextRequest) {
  const auth = await requireAuth()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const rateCheck = checkRateLimit(`generate:${auth.userId}`, 10, 60_000)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Zu viele Anfragen. Bitte warte einen Moment.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rateCheck.retryAfterMs / 1000)) },
      }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
  }

  const parsed = GenerateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { projekt_id, datum } = parsed.data
  const service = createServiceClient()

  // Projekt laden
  const { data: projekt } = await service
    .from('projekte')
    .select('id, name, nummer')
    .eq('id', projekt_id)
    .single()

  if (!projekt) {
    return NextResponse.json({ error: 'Projekt nicht gefunden' }, { status: 404 })
  }

  // Begehungen des Tages laden
  const { data: begehungen, error: begErr } = await service
    .from('begehungen')
    .select(`
      id, datum, uhrzeit, wetterbedingungen, temperatur,
      leistungsstand, vorkommnisse, massnahmen, bemerkungen, status,
      bearbeiter:nutzer_profile(id, email),
      teilnehmer:begehung_teilnehmer(id, name, rolle)
    `)
    .eq('projekt_id', projekt_id)
    .eq('datum', datum)
    .eq('status', 'Fertig')
    .order('uhrzeit', { ascending: true })
    .limit(100)

  if (begErr) {
    return NextResponse.json({ error: 'Datenbankfehler beim Laden der Begehungen' }, { status: 500 })
  }

  if (!begehungen || begehungen.length === 0) {
    return NextResponse.json(
      { error: 'Für das gewählte Datum und Projekt liegen keine abgeschlossenen Begehungen vor.' },
      { status: 404 }
    )
  }

  // Fotos aller Begehungen laden
  const begehungsIds = begehungen.map((b) => b.id)
  const { data: fotos } = await service
    .from('fotos')
    .select('id, begehung_id, bildunterschrift')
    .in('begehung_id', begehungsIds)
    .is('geloescht_am', null)
    .order('erstellt_am', { ascending: true })
    .limit(500)

  // Firmeneinstellungen laden
  const { data: einstellungen } = await service
    .from('einstellungen')
    .select('schluessel, wert')
    .in('schluessel', ['firmenname', 'firmenlogo_url'])

  const einstellungenMap: Record<string, string> = {}
  for (const e of einstellungen ?? []) {
    einstellungenMap[e.schluessel] = e.wert
  }

  // Snapshot aufbauen
  const ersteBegehung = begehungen[0] as Record<string, unknown>
  const bearbeiterRaw = ersteBegehung.bearbeiter as { id: string; email: string } | null

  // Alle Teilnehmer der ersten Begehung als Bericht-Teilnehmer (oder zusammenführen)
  const alleTeilnehmer: { name: string; rolle: string }[] = []
  const seenNames = new Set<string>()
  for (const beg of begehungen) {
    const b = beg as Record<string, unknown>
    const tn = b.teilnehmer as { name: string; rolle: string }[] | null
    for (const t of tn ?? []) {
      if (!seenNames.has(t.name)) {
        seenNames.add(t.name)
        alleTeilnehmer.push({ name: t.name, rolle: t.rolle })
      }
    }
  }

  const abschnitte = begehungen.map((beg, idx) => {
    const b = beg as Record<string, unknown>
    const begehungsFotos = (fotos ?? [])
      .filter((f) => f.begehung_id === b.id)
      .slice(0, 50)
      .map((f, fi) => ({
        foto_id: f.id,
        thumb_url: `/api/media/file/${f.id}?thumb=1`,
        display_url: `/api/media/file/${f.id}`,
        bildunterschrift: f.bildunterschrift ?? '',
        sichtbar: true,
        reihenfolge: fi,
      }))

    const freitextTeile: string[] = []
    if (b.leistungsstand) freitextTeile.push(`Leistungsstand: ${b.leistungsstand}`)
    if (b.vorkommnisse) freitextTeile.push(`Vorkommnisse: ${b.vorkommnisse}`)
    if (b.massnahmen) freitextTeile.push(`Maßnahmen: ${b.massnahmen}`)
    if (b.bemerkungen) freitextTeile.push(`Bemerkungen: ${b.bemerkungen}`)

    return {
      begehungs_id: b.id as string,
      titel: `Abschnitt ${idx + 1} – ${datum}`,
      freitext: freitextTeile.join('\n\n'),
      sichtbar: true,
      reihenfolge: idx,
      fotos: begehungsFotos,
    }
  })

  const snapshot: BerichtsSnapshot = {
    deckblatt: {
      firmenlogo_url: einstellungenMap.firmenlogo_url || null,
      projektname: projekt.name,
      projektnummer: projekt.nummer,
      datum,
      uhrzeit: (ersteBegehung.uhrzeit as string) ?? '00:00',
      wetter: (ersteBegehung.wetterbedingungen as string | null) ?? null,
      temperatur: (ersteBegehung.temperatur as number | null) ?? null,
      teilnehmer: alleTeilnehmer,
      erstellt_am: new Date().toISOString(),
      ersteller_name: bearbeiterRaw?.email ?? auth.email,
    },
    abschnitte,
  }

  // Bericht speichern (upsert: Bericht für dieses Projekt + Datum)
  const { data: bericht, error: berErr } = await service
    .from('berichte')
    .upsert(
      {
        projekt_id,
        ersteller_id: auth.userId,
        begehungs_datum: datum,
        aktuelle_version_nr: 1,
      },
      { onConflict: 'projekt_id,begehungs_datum', ignoreDuplicates: false }
    )
    .select('id, aktuelle_version_nr')
    .single()

  if (berErr || !bericht) {
    return NextResponse.json({ error: 'Bericht konnte nicht angelegt werden' }, { status: 500 })
  }

  // Nächste Versionsnummer ermitteln
  const { data: letzteVersion } = await service
    .from('berichts_versionen')
    .select('version_nr')
    .eq('bericht_id', bericht.id)
    .order('version_nr', { ascending: false })
    .limit(1)
    .maybeSingle()

  const naechsteVersionNr = (letzteVersion?.version_nr ?? 0) + 1

  const { error: verErr } = await service.from('berichts_versionen').insert({
    bericht_id: bericht.id,
    version_nr: naechsteVersionNr,
    inhalt: snapshot,
  })

  if (verErr) {
    return NextResponse.json({ error: 'Version konnte nicht gespeichert werden' }, { status: 500 })
  }

  // aktuelle_version_nr im Bericht aktualisieren
  await service
    .from('berichte')
    .update({ aktuelle_version_nr: naechsteVersionNr })
    .eq('id', bericht.id)

  // Warnung wenn mindestens eine Begehung auf 50 Fotos begrenzt wurde
  const hatKuerzung = abschnitte.some((a) => a.fotos.length === 50)
  const warnung = hatKuerzung
    ? 'Mindestens eine Begehung enthielt mehr als 50 Fotos. Es wurden jeweils die ersten 50 übernommen.'
    : undefined

  return NextResponse.json(
    { id: bericht.id, version_nr: naechsteVersionNr, warnung },
    { status: 201 }
  )
}
