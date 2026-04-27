import { describe, it, expect } from 'vitest'
import { renderBerichtHTML } from './bericht-renderer'
import type { BerichtsSnapshot, VorlageSnapshot } from '@/types/berichte'

function makeSnapshot(overrides: Partial<BerichtsSnapshot> = {}): BerichtsSnapshot {
  return {
    deckblatt: {
      firmenlogo_url: null,
      projektname: 'Testprojekt',
      projektnummer: 'TP-001',
      datum: '2026-04-27',
      uhrzeit: '09:00',
      wetter: 'Sonnig',
      temperatur: 18,
      teilnehmer: [{ name: 'Max Muster', rolle: 'Architekt' }],
      erstellt_am: '2026-04-27T12:00:00Z',
      ersteller_name: 'qa@ppb.de',
    },
    abschnitte: [
      {
        begehungs_id: 'beg-1',
        titel: 'Abschnitt 1 – 2026-04-27',
        freitext: 'Leistungsstand: 80%\n\nVorkommnisse: Keine',
        sichtbar: true,
        reihenfolge: 0,
        fotos: [
          {
            foto_id: 'foto-1',
            thumb_url: '/api/media/file/foto-1?thumb=1',
            display_url: '/api/media/file/foto-1',
            bildunterschrift: 'Rohbau Ostseite',
            sichtbar: true,
            reihenfolge: 0,
          },
        ],
      },
    ],
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Deckblatt
// ─────────────────────────────────────────────────────────────────────────────

describe('renderBerichtHTML — Deckblatt', () => {
  it('enthält den Berichtstitel mit Projektname', () => {
    const html = renderBerichtHTML(makeSnapshot())
    expect(html).toContain('Baustellenbegehung')
    expect(html).toContain('Testprojekt')
  })

  it('enthält die Projektnummer', () => {
    const html = renderBerichtHTML(makeSnapshot())
    expect(html).toContain('TP-001')
  })

  it('enthält Datum der Begehung (formatiert)', () => {
    const html = renderBerichtHTML(makeSnapshot())
    // 27. April 2026 in German locale
    expect(html).toContain('27')
    expect(html).toContain('2026')
  })

  it('enthält Uhrzeit', () => {
    const html = renderBerichtHTML(makeSnapshot())
    expect(html).toContain('09:00')
  })

  it('enthält Wetterbedingungen und Temperatur', () => {
    const html = renderBerichtHTML(makeSnapshot())
    expect(html).toContain('Sonnig')
    expect(html).toContain('18 °C')
  })

  it('lässt Wetterzeile weg wenn weder Wetter noch Temperatur', () => {
    const s = makeSnapshot()
    s.deckblatt.wetter = null
    s.deckblatt.temperatur = null
    const html = renderBerichtHTML(s)
    expect(html).not.toContain('Wetter')
  })

  it('enthält Teilnehmer mit Name und Rolle', () => {
    const html = renderBerichtHTML(makeSnapshot())
    expect(html).toContain('Max Muster')
    expect(html).toContain('Architekt')
  })

  it('zeigt "Keine Teilnehmer angegeben" wenn Liste leer', () => {
    const s = makeSnapshot()
    s.deckblatt.teilnehmer = []
    const html = renderBerichtHTML(s)
    expect(html).toContain('Keine Teilnehmer angegeben')
  })

  it('enthält Erstellungsdatum und Ersteller', () => {
    const html = renderBerichtHTML(makeSnapshot())
    expect(html).toContain('qa@ppb.de')
    expect(html).toContain('2026')
  })

  it('zeigt Platzhalter-Firmenname wenn kein Logo und keine Vorlage', () => {
    const html = renderBerichtHTML(makeSnapshot())
    // Kein Logo → Projektname als Platzhalter
    expect(html).toContain('Testprojekt')
  })

  it('zeigt Firmenlogo wenn firmenlogo_url gesetzt', () => {
    const s = makeSnapshot()
    s.deckblatt.firmenlogo_url = 'https://example.com/logo.png'
    const html = renderBerichtHTML(s)
    expect(html).toContain('https://example.com/logo.png')
    expect(html).toContain('<img')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Abschnitte
// ─────────────────────────────────────────────────────────────────────────────

describe('renderBerichtHTML — Abschnitte', () => {
  it('rendert sichtbare Abschnitte', () => {
    const html = renderBerichtHTML(makeSnapshot())
    expect(html).toContain('Abschnitt 1 – 2026-04-27')
  })

  it('blendet ausgeblendete Abschnitte aus', () => {
    const s = makeSnapshot()
    s.abschnitte[0].sichtbar = false
    const html = renderBerichtHTML(s)
    expect(html).not.toContain('Abschnitt 1 – 2026-04-27')
  })

  it('rendert Freitext mit Zeilenumbrüchen als <br/>', () => {
    const html = renderBerichtHTML(makeSnapshot())
    expect(html).toContain('Leistungsstand: 80%')
    expect(html).toContain('<br/>')
  })

  it('zeigt Nachricht wenn keine sichtbaren Abschnitte', () => {
    const s = makeSnapshot()
    s.abschnitte[0].sichtbar = false
    const html = renderBerichtHTML(s)
    expect(html).toContain('Keine sichtbaren Abschnitte')
  })

  it('sortiert Abschnitte nach reihenfolge', () => {
    const s = makeSnapshot()
    s.abschnitte = [
      { ...s.abschnitte[0], begehungs_id: 'beg-2', titel: 'Abschnitt B', reihenfolge: 1, fotos: [] },
      { ...s.abschnitte[0], begehungs_id: 'beg-1', titel: 'Abschnitt A', reihenfolge: 0, fotos: [] },
    ]
    const html = renderBerichtHTML(s)
    const posA = html.indexOf('Abschnitt A')
    const posB = html.indexOf('Abschnitt B')
    expect(posA).toBeLessThan(posB)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Foto-Galerie
// ─────────────────────────────────────────────────────────────────────────────

describe('renderBerichtHTML — Foto-Galerie', () => {
  it('rendert sichtbare Fotos mit display_url', () => {
    const html = renderBerichtHTML(makeSnapshot())
    expect(html).toContain('/api/media/file/foto-1')
    expect(html).toContain('Rohbau Ostseite')
  })

  it('blendet ausgeblendete Fotos aus', () => {
    const s = makeSnapshot()
    s.abschnitte[0].fotos[0].sichtbar = false
    const html = renderBerichtHTML(s)
    expect(html).not.toContain('Rohbau Ostseite')
  })

  it('rendert kein Bildunterschrift-Tag wenn leer', () => {
    const s = makeSnapshot()
    s.abschnitte[0].fotos[0].bildunterschrift = ''
    const html = renderBerichtHTML(s)
    // Bildunterschrift-Tag darf nicht erscheinen
    expect(html).not.toContain('class="bildunterschrift"')
  })

  it('sortiert Fotos nach reihenfolge', () => {
    const s = makeSnapshot()
    s.abschnitte[0].fotos = [
      { foto_id: 'f2', thumb_url: '', display_url: '/f2', bildunterschrift: 'Bild B', sichtbar: true, reihenfolge: 1 },
      { foto_id: 'f1', thumb_url: '', display_url: '/f1', bildunterschrift: 'Bild A', sichtbar: true, reihenfolge: 0 },
    ]
    const html = renderBerichtHTML(s)
    const posA = html.indexOf('Bild A')
    const posB = html.indexOf('Bild B')
    expect(posA).toBeLessThan(posB)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Print-CSS & Layout
// ─────────────────────────────────────────────────────────────────────────────

describe('renderBerichtHTML — Print-CSS & Layout', () => {
  it('enthält @media print CSS', () => {
    const html = renderBerichtHTML(makeSnapshot())
    expect(html).toContain('@media print')
  })

  it('setzt A4-Seitenbreite (210mm)', () => {
    const html = renderBerichtHTML(makeSnapshot())
    expect(html).toContain('210mm')
  })

  it('setzt 20mm Ränder', () => {
    const html = renderBerichtHTML(makeSnapshot())
    expect(html).toContain('20mm')
  })

  it('gibt gültiges HTML zurück (DOCTYPE + html + head + body)', () => {
    const html = renderBerichtHTML(makeSnapshot())
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<html lang="de">')
    expect(html).toContain('<head>')
    expect(html).toContain('<body>')
  })

  it('gibt Foto-Galerie mit 2 Spalten aus', () => {
    const html = renderBerichtHTML(makeSnapshot())
    expect(html).toContain('grid-template-columns: 1fr 1fr')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Vorlagen
// ─────────────────────────────────────────────────────────────────────────────

describe('renderBerichtHTML — Vorlagen', () => {
  const vorlage: VorlageSnapshot & { logo_url?: string | null } = {
    name: 'Testvorlage',
    logo_pfad: null,
    logo_url: null,
    firmenname: 'PPB Architekten',
    primaerfarbe: '#003366',
    sekundaerfarbe: '#666666',
    kopfzeilen_text: 'Vertraulich',
    fusszeilen_text: 'Seite 1',
    schriftgroesse: 'gross',
  }

  it('verwendet Primärfarbe aus Vorlage', () => {
    const html = renderBerichtHTML(makeSnapshot(), vorlage)
    expect(html).toContain('#003366')
  })

  it('verwendet Sekundärfarbe aus Vorlage', () => {
    const html = renderBerichtHTML(makeSnapshot(), vorlage)
    expect(html).toContain('#666666')
  })

  it('rendert Kopfzeilen-Text', () => {
    const html = renderBerichtHTML(makeSnapshot(), vorlage)
    expect(html).toContain('Vertraulich')
  })

  it('rendert Fußzeilen-Text', () => {
    const html = renderBerichtHTML(makeSnapshot(), vorlage)
    expect(html).toContain('Seite 1')
  })

  it('verwendet "gross" Schriftgröße (13pt)', () => {
    const html = renderBerichtHTML(makeSnapshot(), vorlage)
    expect(html).toContain('13pt')
  })

  it('verwendet "klein" Schriftgröße (10pt)', () => {
    const vKlein = { ...vorlage, schriftgroesse: 'klein' as const }
    const html = renderBerichtHTML(makeSnapshot(), vKlein)
    expect(html).toContain('10pt')
  })

  it('zeigt Firmennamen aus Vorlage als Platzhalter wenn kein Logo', () => {
    const html = renderBerichtHTML(makeSnapshot(), vorlage)
    expect(html).toContain('PPB Architekten')
  })

  it('zeigt Vorlagen-Logo wenn logo_url gesetzt', () => {
    const vMitLogo = { ...vorlage, logo_url: '/api/templates/123/logo' }
    const html = renderBerichtHTML(makeSnapshot(), vMitLogo)
    expect(html).toContain('/api/templates/123/logo')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Sicherheit — XSS-Prüfung
// ─────────────────────────────────────────────────────────────────────────────

describe('renderBerichtHTML — XSS-Sicherheit', () => {
  it('SICHERHEIT: Script-Tags in Abschnittstitel werden HTML-escaped (kein XSS)', () => {
    const s = makeSnapshot()
    s.abschnitte[0].titel = '<script>alert("XSS")</script>'
    const html = renderBerichtHTML(s)
    // Unescaped Tag darf nicht im HTML vorkommen
    expect(html).not.toContain('<script>alert("XSS")</script>')
    // Escaped Variante muss vorhanden sein
    expect(html).toContain('&lt;script&gt;')
  })

  it('SICHERHEIT: Event-Handler in Bildunterschrift werden HTML-escaped (kein XSS)', () => {
    const s = makeSnapshot()
    s.abschnitte[0].fotos[0].bildunterschrift = '<img src=x onerror="alert(1)">'
    const html = renderBerichtHTML(s)
    // Unescaped Tag darf nicht im Output erscheinen
    expect(html).not.toContain('<img src=x onerror="alert(1)">')
    expect(html).toContain('&lt;img')
  })

  it('SICHERHEIT: HTML-Entities in Freitext werden escaped', () => {
    const s = makeSnapshot()
    s.abschnitte[0].freitext = '<b>fett</b> & "Anführung"'
    const html = renderBerichtHTML(s)
    expect(html).not.toContain('<b>fett</b>')
    expect(html).toContain('&lt;b&gt;fett&lt;/b&gt;')
    expect(html).toContain('&amp;')
    expect(html).toContain('&quot;')
  })

  it('SICHERHEIT: Projektname mit Sonderzeichen wird escaped', () => {
    const s = makeSnapshot()
    s.deckblatt.projektname = '<script>alert(1)</script>'
    const html = renderBerichtHTML(s)
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('SICHERHEIT: Teilnehmer-Name und Rolle werden escaped', () => {
    const s = makeSnapshot()
    s.deckblatt.teilnehmer = [{ name: '<b>Hacker</b>', rolle: '"><script>x</script>' }]
    const html = renderBerichtHTML(s)
    expect(html).not.toContain('<b>Hacker</b>')
    expect(html).not.toContain('<script>x</script>')
    expect(html).toContain('&lt;b&gt;Hacker&lt;/b&gt;')
  })
})
