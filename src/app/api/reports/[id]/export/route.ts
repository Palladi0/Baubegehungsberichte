import fs from 'fs'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-service'
import { requireAuth } from '@/lib/auth'
import type { BerichtsSnapshot, VorlageSnapshot } from '@/types/berichte'
import { renderBerichtHTML } from '@/lib/bericht-renderer'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// In-memory rate limit: max 1 Export pro Nutzer alle 60 Sekunden
const exportZeitstempel = new Map<string, number>()
const RATE_LIMIT_MS = 60_000

const PDF_BASE = process.env.PDF_UPLOAD_PATH ?? path.join(process.cwd(), 'uploads', 'pdf')
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads', 'photos')

function escHtmlSimple(s: string | null | undefined): string {
  if (!s) return ''
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// SVG-Platzhalter, der direkt als data-URI eingebettet wird
const FOTO_PLATZHALTER_URI =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">' +
    '<rect width="400" height="300" fill="#f3f4f6"/>' +
    '<text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" ' +
    'font-family="Arial,sans-serif" font-size="14" fill="#9ca3af">[Foto nicht verfügbar]</text>' +
    '</svg>'
  )

// Extrahiert die Foto-UUID aus URLs wie /api/media/file/[uuid]?v=display
function extractFotoId(url: string): string | null {
  const match = url.match(/\/api\/media\/file\/([0-9a-f-]{36})/i)
  return match?.[1] ?? null
}

// Liest Fotos vom Dateisystem und gibt eine Map von URL → data-URI zurück.
// Fehlendes Foto → Platzhalter-URI (BUG-006).
function resolvePhotoUrls(snapshot: BerichtsSnapshot): BerichtsSnapshot {
  return {
    ...snapshot,
    abschnitte: snapshot.abschnitte.map((abschnitt) => ({
      ...abschnitt,
      fotos: abschnitt.fotos.map((foto) => {
        if (!foto.sichtbar) return foto
        const fotoId = extractFotoId(foto.display_url)
        if (!fotoId) return foto

        const filePath = path.join(UPLOAD_DIR, fotoId, 'display.jpg')
        try {
          const buffer = fs.readFileSync(filePath)
          const dataUri = `data:image/jpeg;base64,${buffer.toString('base64')}`
          return { ...foto, display_url: dataUri }
        } catch {
          return { ...foto, display_url: FOTO_PLATZHALTER_URI }
        }
      }),
    })),
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params

  // Rate-Limit: 1 Export pro Nutzer alle 60 Sekunden (Schutz vor parallelen Puppeteer-Prozessen)
  const jetzt = Date.now()
  const letzterExport = exportZeitstempel.get(auth.userId) ?? 0
  if (jetzt - letzterExport < RATE_LIMIT_MS) {
    const wartezeit = Math.ceil((RATE_LIMIT_MS - (jetzt - letzterExport)) / 1000)
    return NextResponse.json(
      { error: `Bitte warten Sie ${wartezeit} Sekunden vor dem nächsten Export.` },
      { status: 429 }
    )
  }
  exportZeitstempel.set(auth.userId, jetzt)

  const service = createServiceClient()

  // Zugriffscheck + Bericht laden
  const { data: bericht } = await service
    .from('berichte')
    .select('projekt_id, aktuelle_version_nr, begehungs_datum, vorlage_id')
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

  // Aktuellste Version laden
  const { data: version } = await service
    .from('berichts_versionen')
    .select('inhalt, version_nr')
    .eq('bericht_id', id)
    .eq('version_nr', (bericht as Record<string, unknown>).aktuelle_version_nr as number)
    .single()

  if (!version) {
    return NextResponse.json({ error: 'Berichtsversion nicht gefunden' }, { status: 404 })
  }

  // Template laden (vorlage_id aus berichte, Fallback: Standard-Template)
  const vorlageId = (bericht as Record<string, unknown>).vorlage_id as string | null
  let vorlage: (VorlageSnapshot & { id?: string; logo_url?: string | null }) | null = null

  const templateQuery = vorlageId
    ? service.from('berichts_vorlagen').select('*').eq('id', vorlageId).single()
    : service.from('berichts_vorlagen').select('*').eq('ist_standard', true).single()

  const { data: templateData } = await templateQuery

  if (templateData) {
    // Logo als Data-URI einbetten, damit Puppeteer keine HTTP-Anfrage stellen muss
    let logoDataUri: string | null = null
    if (templateData.logo_pfad) {
      try {
        const absPath = path.isAbsolute(templateData.logo_pfad)
          ? templateData.logo_pfad
          : path.join(process.cwd(), templateData.logo_pfad)
        if (fs.existsSync(absPath)) {
          const buffer = fs.readFileSync(absPath)
          const ext = path.extname(absPath).toLowerCase().slice(1)
          const mimeMap: Record<string, string> = {
            png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
            webp: 'image/webp', svg: 'image/svg+xml',
          }
          const mime = mimeMap[ext] ?? 'image/png'
          logoDataUri = `data:${mime};base64,${buffer.toString('base64')}`
        }
      } catch { /* Logo nicht kritisch — weiter ohne */ }
    }

    vorlage = {
      ...templateData,
      logo_url: logoDataUri,
    } as VorlageSnapshot & { id?: string; logo_url?: string | null }
  }

  const snapshot = version.inhalt as BerichtsSnapshot

  // vorlage_snapshot in den Snapshot einfrieren (für historische PDFs)
  const snapshotMitVorlage: BerichtsSnapshot = vorlage
    ? {
        ...snapshot,
        vorlage_snapshot: {
          name: vorlage.name,
          logo_pfad: vorlage.logo_pfad ?? null,
          firmenname: vorlage.firmenname,
          primaerfarbe: vorlage.primaerfarbe,
          sekundaerfarbe: vorlage.sekundaerfarbe,
          kopfzeilen_text: vorlage.kopfzeilen_text,
          fusszeilen_text: vorlage.fusszeilen_text,
          schriftgroesse: vorlage.schriftgroesse,
        },
      }
    : snapshot

  const fotoAnzahl = snapshot.abschnitte.reduce(
    (sum, a) => sum + a.fotos.filter((f) => f.sichtbar).length,
    0
  )
  const timeout = fotoAnzahl > 100 ? 120_000 : 30_000

  fs.mkdirSync(PDF_BASE, { recursive: true })
  const pdfPfad = path.join(PDF_BASE, `${id}.pdf`)

  if (fs.existsSync(pdfPfad)) {
    try { fs.unlinkSync(pdfPfad) } catch { /* ignore */ }
  }

  // Kopf- und Fußzeilen-Templates für Puppeteer (standalone HTML, kein Zugriff auf Seiten-CSS)
  const logoImgHtml = vorlage?.logo_url
    ? `<img src="${vorlage.logo_url}" style="height:18px;max-width:80px;object-fit:contain;display:block;" />`
    : `<span style="font-weight:700;">${escHtmlSimple(vorlage?.firmenname ?? snapshot.deckblatt.projektname)}</span>`

  const berichtsTitel = `Baustellenbegehung – ${escHtmlSimple(snapshot.deckblatt.projektname)}`
  const berichtsDatum = new Date(snapshot.deckblatt.datum).toLocaleDateString('de-DE', { dateStyle: 'short' })
  const projektnummer = escHtmlSimple(snapshot.deckblatt.projektnummer)
  const erstellerName = escHtmlSimple(snapshot.deckblatt.ersteller_name)

  const headerTemplate = `
    <div style="width:100%;padding:4px 20mm 4px;display:flex;align-items:center;justify-content:space-between;
                font-family:'Inter',Arial,sans-serif;font-size:8px;color:#555;border-bottom:1px solid #ddd;">
      <div style="min-width:80px;">${logoImgHtml}</div>
      <div style="text-align:center;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 8px;">
        ${berichtsTitel}
      </div>
      <div style="min-width:60px;text-align:right;">${berichtsDatum}</div>
    </div>`

  const footerTemplate = `
    <div style="width:100%;padding:4px 20mm 4px;display:flex;align-items:center;justify-content:space-between;
                font-family:'Inter',Arial,sans-serif;font-size:8px;color:#555;border-top:1px solid #ddd;">
      <div style="min-width:80px;">Nr. ${projektnummer}</div>
      <div style="text-align:center;flex:1;">${erstellerName}</div>
      <div style="min-width:80px;text-align:right;">Seite <span class="pageNumber"></span> von <span class="totalPages"></span></div>
    </div>`

  let browser: import('puppeteer').Browser | null = null

  try {
    const puppeteer = await import('puppeteer')
    browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    })

    const page = await browser.newPage()
    // Foto-URLs → data URIs; fehlende Fotos → SVG-Platzhalter (kein HTTP-Request nötig)
    const snapshotMitFotos = resolvePhotoUrls(snapshotMitVorlage)
    const html = renderBerichtHTML(snapshotMitFotos, vorlage ?? undefined)
    await page.setContent(html, { waitUntil: 'load', timeout })

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate,
      footerTemplate,
      // Ränder: oben/unten vergrößert, damit Kopf-/Fußzeile (je ~12mm) reinpasst
      margin: { top: '28mm', bottom: '24mm', left: '20mm', right: '20mm' },
      timeout,
    })

    fs.writeFileSync(pdfPfad, pdfBuffer)
  } catch (err) {
    if (fs.existsSync(pdfPfad)) {
      try { fs.unlinkSync(pdfPfad) } catch { /* ignore */ }
    }
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[pdf-export] Fehler bei Bericht ${id}: ${msg}`)
    return NextResponse.json(
      { error: 'PDF-Generierung fehlgeschlagen. Bitte erneut versuchen.' },
      { status: 500 }
    )
  } finally {
    if (browser) {
      try { await browser.close() } catch { /* ignore */ }
    }
  }

  // DB aktualisieren
  await service
    .from('berichte')
    .update({
      pdf_pfad: pdfPfad,
      pdf_generiert_am: new Date().toISOString(),
      pdf_versions_nr: version.version_nr,
    })
    .eq('id', id)

  const datumStr = (bericht as Record<string, unknown>).begehungs_datum as string
  const projektkuerzel = snapshot.deckblatt.projektnummer.replace(/[^a-zA-Z0-9-_]/g, '_')
  const dateiname = `${projektkuerzel}_Begehung_${datumStr.slice(0, 10)}.pdf`

  return NextResponse.json({
    ok: true,
    dateiname,
    version_nr: version.version_nr,
    foto_anzahl: fotoAnzahl,
    vorlage_name: vorlage?.name ?? null,
    warnung: fotoAnzahl > 100 ? `Bericht enthält ${fotoAnzahl} Fotos — Export kann länger dauern.` : null,
  })
}
