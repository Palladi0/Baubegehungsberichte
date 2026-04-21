# PROJ-6: PDF-Export

## Status: Planned
**Created:** 2026-04-21
**Last Updated:** 2026-04-21

## Dependencies
- Requires: PROJ-5 (Berichtsgenerierung) — HTML-Bericht als Basis für den PDF-Export

## Beschreibung
Der fertige HTML-Bericht wird in ein professionelles, druckfertiges PDF konvertiert. Das PDF ist DIN-A4-formatiert, mit korrekter Seitennummerierung, Kopf- und Fußzeile, und entspricht dem Layout der HTML-Vorschau. Der Export erfolgt auf Knopfdruck und das PDF kann direkt heruntergeladen oder per E-Mail weitergeleitet werden.

## User Stories
- Als **Mitarbeiter** möchte ich den fertigen Bericht als PDF herunterladen, damit ich ihn an Auftraggeber und Behörden weitergeben kann.
- Als **Mitarbeiter** möchte ich das PDF sofort nach der Berichtsgenerierung exportieren, ohne zusätzliche Software installieren zu müssen.
- Als **Admin** möchte ich das PDF-Layout mit Firmenlogo, Kopf- und Fußzeile konfigurieren, damit alle Berichte unser Corporate Design widerspiegeln.
- Als **Mitarbeiter** möchte ich das PDF in der App als Vorschau sehen, bevor ich es herunterlade, damit ich Fehler erkennen kann.

## Acceptance Criteria
- [ ] PDF-Export-Button im Bericht-Editor und in der Berichtsübersicht sichtbar
- [ ] PDF wird serverseitig generiert (nicht clientseitig) für konsistentes Layout
- [ ] Format: DIN A4, Hochformat, 2 cm Ränder (oben/unten/links/rechts)
- [ ] **Kopfzeile** auf jeder Seite: Firmenlogo (links), Berichtstitel (Mitte), Datum (rechts)
- [ ] **Fußzeile** auf jeder Seite: Projektnummer (links), Ersteller (Mitte), Seitennummer „Seite X von Y" (rechts)
- [ ] Seitenumbrüche: Neue Begehung/Abschnitt beginnt immer auf neuer Seite
- [ ] Fotos: max. 2 nebeneinander, mit Bildunterschrift darunter, Fotos werden nie abgeschnitten
- [ ] Schriftart: Serifenlos (z. B. Inter, Arial), min. 10pt Fließtext, 14pt Überschriften
- [ ] Dateiname des PDFs: `[Projektkuerzel]_Begehung_[YYYY-MM-DD].pdf`
- [ ] PDF-Generierung dauert max. 30 Sekunden (für typische Berichte mit ~20 Fotos)
- [ ] Ladefortschrittsanzeige während der PDF-Generierung
- [ ] Generierte PDFs werden auf dem Server gespeichert und sind erneut abrufbar (kein Re-Generieren nötig)

## Edge Cases
- Was passiert, wenn der Bericht sehr viele Fotos enthält (> 100)? → Warnung vor Export; Export wird trotzdem durchgeführt; Timeout auf 120 Sekunden erhöht.
- Was passiert, wenn ein Foto beim PDF-Rendering nicht gefunden wird (gelöscht)? → Foto wird durch Platzhalter „[Foto nicht verfügbar]" ersetzt; Export schlägt nicht fehl.
- Was passiert, wenn die PDF-Generierung serverseitig abbricht? → Fehlermeldung mit Option, es erneut zu versuchen; halb-generierte Datei wird gelöscht.
- Was passiert mit sehr langen Texten in Freitextfeldern? → Text läuft auf die nächste Seite; kein Text wird abgeschnitten.
- Was passiert, wenn kein Firmenlogo konfiguriert ist? → Firmenname als Text in der Kopfzeile (aus Admin-Einstellungen); kein leerer Bereich.

## Technical Requirements
- PDF-Rendering-Engine: Puppeteer (headless Chromium) oder wkhtmltopdf für pixelgenaue HTML→PDF Konvertierung
- Schriftarten werden server-seitig eingebettet (kein Laden aus CDN zur Render-Zeit)
- Generierte PDFs: Gespeichert unter `/var/reports/pdf/[report-id].pdf`
- PDF/A-Kompatibilität: Optional für Archivierungszwecke (P2)
- API-Endpunkte: POST /reports/:id/export, GET /reports/:id/download

---

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
