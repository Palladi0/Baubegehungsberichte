import fs from 'fs'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase-service'
import { requireAuth } from '@/lib/auth'
import type { BerichtsSnapshot } from '@/types/berichte'

const PDF_BASE = process.env.PDF_UPLOAD_PATH ?? path.join(process.cwd(), 'uploads', 'pdf')

export const dynamic = 'force-dynamic'

async function pruefeBerechtigung(
  service: ReturnType<typeof createServiceClient>,
  berichtId: string,
  auth: { userId: string; role: string }
) {
  const { data: bericht } = await service
    .from('berichte')
    .select('id, projekt_id, ersteller_id')
    .eq('id', berichtId)
    .single()

  if (!bericht) return null

  if (auth.role === 'admin') return bericht

  const { data: pm } = await service
    .from('projekt_mitarbeiter')
    .select('nutzer_id')
    .eq('projekt_id', bericht.projekt_id)
    .eq('nutzer_id', auth.userId)
    .maybeSingle()

  return pm ? bericht : null
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const service = createServiceClient()
  const berechtigt = await pruefeBerechtigung(service, id, auth)
  if (!berechtigt) {
    return NextResponse.json({ error: 'Bericht nicht gefunden' }, { status: 404 })
  }

  const { data: berichtData } = await service
    .from('berichte')
    .select(`
      id, begehungs_datum, aktuelle_version_nr, erstellt_am, aktualisiert_am,
      pdf_pfad, pdf_generiert_am, pdf_versions_nr, vorlage_id,
      projekt:projekte(id, name, nummer),
      ersteller:nutzer_profile(id, email)
    `)
    .eq('id', id)
    .single()

  if (!berichtData) {
    return NextResponse.json({ error: 'Bericht nicht gefunden' }, { status: 404 })
  }

  const { data: versionData } = await service
    .from('berichts_versionen')
    .select('id, version_nr, erstellt_am, inhalt')
    .eq('bericht_id', id)
    .eq('version_nr', berichtData.aktuelle_version_nr)
    .single()

  // Supabase gibt joined relations als Array zurück – wir nehmen das erste Element
  const projektRaw = berichtData.projekt
  const erstellerRaw = berichtData.ersteller
  const projekt = (Array.isArray(projektRaw) ? projektRaw[0] : projektRaw) as {
    id: string; name: string; nummer: string
  } | null
  const ersteller = (Array.isArray(erstellerRaw) ? erstellerRaw[0] : erstellerRaw) as {
    id: string; email: string
  } | null

  return NextResponse.json({
    id: berichtData.id,
    projekt_id: projekt?.id ?? '',
    projekt_name: projekt?.name ?? '',
    projekt_nummer: projekt?.nummer ?? '',
    ersteller_id: ersteller?.id ?? '',
    ersteller_email: ersteller?.email ?? '',
    begehungs_datum: berichtData.begehungs_datum,
    aktuelle_version_nr: berichtData.aktuelle_version_nr,
    erstellt_am: berichtData.erstellt_am,
    aktualisiert_am: berichtData.aktualisiert_am,
    pdf_pfad: berichtData.pdf_pfad ?? null,
    pdf_generiert_am: berichtData.pdf_generiert_am ?? null,
    pdf_versions_nr: berichtData.pdf_versions_nr ?? null,
    vorlage_id: (berichtData as Record<string, unknown>).vorlage_id as string | null ?? null,
    aktuelle_version: versionData ?? null,
  })
}

const UpdateSchema = z.object({
  inhalt: z.unknown(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const service = createServiceClient()
  const berechtigt = await pruefeBerechtigung(service, id, auth)
  if (!berechtigt) {
    return NextResponse.json({ error: 'Bericht nicht gefunden' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
  }

  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validierungsfehler', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const inhalt = parsed.data.inhalt
  if (
    !inhalt ||
    typeof inhalt !== 'object' ||
    !('deckblatt' in inhalt) ||
    !('abschnitte' in inhalt)
  ) {
    return NextResponse.json({ error: 'Ungültiger Berichtsinhalt' }, { status: 422 })
  }

  const { data: aktuellerBericht } = await service
    .from('berichte')
    .select('aktuelle_version_nr')
    .eq('id', id)
    .single()

  const naechsteVersionNr = (aktuellerBericht?.aktuelle_version_nr ?? 0) + 1

  const { error: verErr } = await service.from('berichts_versionen').insert({
    bericht_id: id,
    version_nr: naechsteVersionNr,
    inhalt: inhalt as BerichtsSnapshot,
  })

  if (verErr) {
    return NextResponse.json({ error: 'Version konnte nicht gespeichert werden' }, { status: 500 })
  }

  await service
    .from('berichte')
    .update({ aktuelle_version_nr: naechsteVersionNr })
    .eq('id', id)

  return NextResponse.json({ version_nr: naechsteVersionNr })
}

const PatchSchema = z.object({
  vorlage_id: z.string().uuid().nullable(),
})

// PATCH: Nur vorlage_id aktualisieren — erzeugt keine neue Version
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const service = createServiceClient()
  const berechtigt = await pruefeBerechtigung(service, id, auth)
  if (!berechtigt) {
    return NextResponse.json({ error: 'Bericht nicht gefunden' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
  }

  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { error } = await service
    .from('berichte')
    .update({ vorlage_id: parsed.data.vorlage_id })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'Aktualisierung fehlgeschlagen' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
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
    .select('id, ersteller_id, pdf_pfad')
    .eq('id', id)
    .single()

  if (!bericht) {
    return NextResponse.json({ error: 'Bericht nicht gefunden' }, { status: 404 })
  }

  // Nur Admin oder Eigentümer dürfen löschen
  if (auth.role !== 'admin' && bericht.ersteller_id !== auth.userId) {
    return NextResponse.json({ error: 'Zugriff verweigert' }, { status: 403 })
  }

  // PDF-Datei löschen (best-effort)
  if (bericht.pdf_pfad) {
    try {
      const pdfAbs = path.isAbsolute(bericht.pdf_pfad)
        ? bericht.pdf_pfad
        : path.join(PDF_BASE, bericht.pdf_pfad)
      if (fs.existsSync(pdfAbs)) fs.unlinkSync(pdfAbs)
    } catch {
      // Datei-Fehler soll Löschung nicht blockieren
    }
  }

  const { error } = await service.from('berichte').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ error: 'Bericht konnte nicht gelöscht werden' }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
