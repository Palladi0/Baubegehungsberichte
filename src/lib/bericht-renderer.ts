import fs from 'fs'
import path from 'path'
import type { BerichtsSnapshot, AbschnittInBericht, FotoInBericht, VorlageSnapshot } from '@/types/berichte'

function ladeFontDataUri(dateiname: string): string | null {
  try {
    const absPath = path.join(process.cwd(), 'public', 'fonts', dateiname)
    const buffer = fs.readFileSync(absPath)
    return `data:font/woff2;base64,${buffer.toString('base64')}`
  } catch {
    return null
  }
}

const INTER_400 = ladeFontDataUri('inter-400.woff2')
const INTER_700 = ladeFontDataUri('inter-700.woff2')

function interFontFace(): string {
  if (!INTER_400 && !INTER_700) return ''
  const r400 = INTER_400
    ? `@font-face { font-family: 'Inter'; font-style: normal; font-weight: 400; src: url('${INTER_400}') format('woff2'); }`
    : ''
  const r700 = INTER_700
    ? `@font-face { font-family: 'Inter'; font-style: normal; font-weight: 700; src: url('${INTER_700}') format('woff2'); }`
    : ''
  return `${r400}\n    ${r700}`
}

function formatiereDatum(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('de-DE', { dateStyle: 'long' })
  } catch {
    return iso
  }
}

function escHtml(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const SCHRIFT_MAP: Record<string, string> = {
  klein: '10pt',
  mittel: '11pt',
  gross: '13pt',
}

function renderFoto(foto: FotoInBericht): string {
  if (!foto.sichtbar) return ''
  return `
    <div class="foto-item">
      <img src="${escHtml(foto.display_url)}" alt="${escHtml(foto.bildunterschrift) || 'Foto'}" loading="eager" />
      ${foto.bildunterschrift ? `<p class="bildunterschrift">${escHtml(foto.bildunterschrift)}</p>` : ''}
    </div>`
}

function renderAbschnitt(abschnitt: AbschnittInBericht): string {
  if (!abschnitt.sichtbar) return ''
  const sichtbareFotos = abschnitt.fotos
    .filter((f) => f.sichtbar)
    .sort((a, b) => a.reihenfolge - b.reihenfolge)

  return `
    <section class="abschnitt page-break-before">
      <h2 class="abschnitt-titel">${escHtml(abschnitt.titel)}</h2>
      ${abschnitt.freitext ? `<div class="freitext">${escHtml(abschnitt.freitext).replace(/\n/g, '<br/>')}</div>` : ''}
      ${sichtbareFotos.length > 0 ? `
        <div class="foto-galerie">
          ${sichtbareFotos.map(renderFoto).join('')}
        </div>` : ''}
    </section>`
}

export function renderBerichtHTML(snapshot: BerichtsSnapshot, vorlage?: VorlageSnapshot | null): string {
  const { deckblatt, abschnitte } = snapshot

  // Vorlage-Werte auflösen (Fallbacks auf Snapshot-Werte oder Defaults)
  const v = vorlage ?? snapshot.vorlage_snapshot
  const primaerfarbe = v?.primaerfarbe ?? '#1a1a1a'
  const sekundaerfarbe = v?.sekundaerfarbe ?? '#374151'
  const schriftBasis = SCHRIFT_MAP[v?.schriftgroesse ?? 'mittel'] ?? '11pt'
  const kopfzeilenText = v?.kopfzeilen_text ?? ''
  const fusszeileText = v?.fusszeilen_text ?? ''
  const firmenname = v?.firmenname ?? ''

  // Logo: Template-Logo hat Priorität vor Report-Logo
  const logoUrl = v?.logo_pfad ? null : (deckblatt.firmenlogo_url ?? null)
  // logo_pfad wird als data-URI vom Aufrufer aufgelöst (Puppeteer: file://, Preview: /api/...)
  const logoSrc = (v as (VorlageSnapshot & { logo_url?: string | null }) | undefined)?.logo_url
    ?? logoUrl

  const logoBlock = logoSrc
    ? `<img src="${escHtml(logoSrc)}" alt="Firmenlogo" class="firmenlogo" />`
    : firmenname
      ? `<div class="firmenname-platzhalter">${escHtml(firmenname)}</div>`
      : `<div class="firmenname-platzhalter">${escHtml(deckblatt.projektname)}</div>`

  const sichtbareAbschnitte = abschnitte
    .filter((a) => a.sichtbar)
    .sort((a, b) => a.reihenfolge - b.reihenfolge)

  const teilnehmerListeHtml = deckblatt.teilnehmer.length > 0
    ? `<ol class="teilnehmer-liste">
        ${deckblatt.teilnehmer.map((t) => `<li>${escHtml(t.name)}${t.rolle ? ` <span class="rolle">(${escHtml(t.rolle)})</span>` : ''}</li>`).join('')}
       </ol>`
    : '<p class="leer">Keine Teilnehmer angegeben</p>'

  const wetterText = [
    deckblatt.wetter,
    deckblatt.temperatur != null ? `${deckblatt.temperatur} °C` : null,
  ]
    .filter(Boolean)
    .join(', ')

  const fusszeileHtml = fusszeileText
    ? `<div class="fusszeile">${escHtml(fusszeileText)}</div>`
    : ''

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Baustellenbegehung – ${escHtml(deckblatt.projektname)}</title>
  <style>
    ${interFontFace()}

    :root {
      --farbe-primaer: ${primaerfarbe};
      --farbe-sekundaer: ${sekundaerfarbe};
      --schrift-basis: ${schriftBasis};
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', Arial, sans-serif;
      font-size: var(--schrift-basis);
      color: #1a1a1a;
      background: #fff;
    }

    /* ---- A4-Seiten-Container ---- */
    .seite {
      width: 210mm;
      min-height: 297mm;
      padding: 20mm;
      margin: 0 auto 16px;
      background: #fff;
      box-shadow: 0 2px 8px rgba(0,0,0,.12);
      display: flex;
      flex-direction: column;
    }
    .seite-inhalt { flex: 1; }

    /* ---- Deckblatt ---- */
    .deckblatt { display: flex; flex-direction: column; gap: 24px; }
    .firmenlogo { max-height: 60px; max-width: 200px; object-fit: contain; }
    .firmenname-platzhalter { font-size: 14pt; font-weight: 700; color: var(--farbe-primaer); }

    .kopfzeilen-text {
      font-size: 8pt;
      color: var(--farbe-sekundaer);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: -12px;
    }

    .bericht-titel { font-size: 22pt; font-weight: 700; line-height: 1.2; margin-top: 32px; color: var(--farbe-primaer); }
    .projekt-nr { font-size: 10pt; color: #666; margin-top: 4px; }

    .meta-tabelle { width: 100%; border-collapse: collapse; margin-top: 24px; }
    .meta-tabelle td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; font-size: 10pt; }
    .meta-tabelle td:first-child { font-weight: 600; width: 40%; color: var(--farbe-primaer); }

    .teilnehmer-abschnitt { margin-top: 24px; }
    .teilnehmer-abschnitt h3 {
      font-size: 11pt; font-weight: 700; margin-bottom: 8px;
      border-bottom: 2px solid var(--farbe-primaer);
      padding-bottom: 4px;
      color: var(--farbe-primaer);
    }
    .teilnehmer-liste { padding-left: 20px; line-height: 1.8; }
    .teilnehmer-liste .rolle { color: #666; font-style: italic; }

    /* ---- Abschnitte ---- */
    .abschnitt { padding-top: 32px; }
    .abschnitt-titel {
      font-size: 14pt; font-weight: 700;
      border-bottom: 2px solid var(--farbe-primaer);
      padding-bottom: 6px; margin-bottom: 16px;
      color: var(--farbe-primaer);
    }

    .freitext { font-size: 10.5pt; line-height: 1.7; white-space: pre-wrap; }

    /* ---- Foto-Galerie ---- */
    .foto-galerie {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 20px;
    }
    .foto-item { break-inside: avoid; }
    .foto-item img {
      width: 100%;
      max-height: 200px;
      height: auto;
      object-fit: contain;
      border-radius: 4px;
      border: 1px solid #e5e7eb;
      display: block;
    }
    .bildunterschrift { font-size: 8.5pt; color: #555; margin-top: 4px; }

    .leer { color: #aaa; font-style: italic; font-size: 10pt; }

    /* ---- Fußzeile ---- */
    .fusszeile {
      margin-top: auto;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
      font-size: 8pt;
      color: var(--farbe-sekundaer);
      text-align: center;
    }

    /* ---- Print ---- */
    @media print {
      body { background: white; }
      .seite {
        width: 100%;
        min-height: 0;
        padding: 20mm;
        margin: 0;
        box-shadow: none;
        page-break-after: always;
      }
      .page-break-before { page-break-before: always; }
      .foto-galerie { break-inside: avoid; }
    }
  </style>
</head>
<body>

  <!-- Deckblatt -->
  <div class="seite">
    <div class="seite-inhalt">
      <div class="deckblatt">
        ${kopfzeilenText ? `<p class="kopfzeilen-text">${escHtml(kopfzeilenText)}</p>` : ''}
        ${logoBlock}

        <div>
          <h1 class="bericht-titel">Baustellenbegehung –<br/>${escHtml(deckblatt.projektname)}</h1>
          <p class="projekt-nr">Projektnummer: ${escHtml(deckblatt.projektnummer)}</p>
        </div>

        <table class="meta-tabelle">
          <tbody>
            <tr><td>Datum der Begehung</td><td>${escHtml(formatiereDatum(deckblatt.datum))}</td></tr>
            <tr><td>Uhrzeit</td><td>${escHtml(deckblatt.uhrzeit)} Uhr</td></tr>
            ${wetterText ? `<tr><td>Wetter</td><td>${escHtml(wetterText)}</td></tr>` : ''}
            <tr><td>Erstellt am</td><td>${escHtml(formatiereDatum(deckblatt.erstellt_am))}</td></tr>
            <tr><td>Erstellt von</td><td>${escHtml(deckblatt.ersteller_name)}</td></tr>
          </tbody>
        </table>

        <div class="teilnehmer-abschnitt">
          <h3>Anwesende Personen</h3>
          ${teilnehmerListeHtml}
        </div>
      </div>
    </div>
    ${fusszeileHtml}
  </div>

  <!-- Folgeseiten -->
  <div class="seite">
    <div class="seite-inhalt">
      ${sichtbareAbschnitte.map(renderAbschnitt).join('\n')}
      ${sichtbareAbschnitte.length === 0 ? '<p class="leer">Keine sichtbaren Abschnitte vorhanden.</p>' : ''}
    </div>
    ${fusszeileHtml}
  </div>

</body>
</html>`
}
