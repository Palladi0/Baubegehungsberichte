# PROJ-6: PDF-Export

## Status: Architected
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

### Gewählter Ansatz: Puppeteer-Pipeline auf bestehender HTML-Vorschau

PROJ-5 liefert bereits einen serverseitig gerenderten HTML-Bericht via `GET /api/reports/[id]/preview` — inklusive Print-CSS. PROJ-6 nutzt genau dieses HTML als Eingabe für **Puppeteer (headless Chromium)**, das daraus ein pixelgenaues PDF erzeugt. Damit ist WYSIWYG zwischen Browser-Vorschau und PDF garantiert, ohne das Layout ein zweites Mal zu definieren.

---

### Komponentenstruktur

```
/berichte/[id]  (Erweiterung des Editors aus PROJ-5)
+-- BerichtsEditorHeader
    +-- PDFExportButton               (shadcn/ui Button — löst Export aus)

+-- PDFExportDialog                   (shadcn/ui Dialog — erscheint beim Klick)
    +-- FortschrittsAnzeige           (shadcn/ui Progress — 0 → 100 %)
    +-- StatusText                    ("PDF wird erstellt..." / "Fertig!")
    +-- DownloadButton                (shadcn/ui Button — erscheint nach Erfolg)
    +-- VersionsHinweis               (shadcn/ui Alert — "PDF basiert auf Version X")
    +-- FehlerZustand
        +-- FehlerMeldung             (shadcn/ui Alert, destructive)
        +-- WiederholenButton         (shadcn/ui Button)

/berichte  (Dashboard PROJ-7 — wird dort eingebunden)
+-- BerichtKarte
    +-- PDFDownloadButton             (direkter Download, wenn PDF vorhanden)
    +-- PDFNeuGenerierenButton        (wenn Report-Version neuer als gespeichertes PDF)
```

---

### Datenmodell

Keine neue Tabelle nötig. Die vorhandene **`berichte`-Tabelle** aus PROJ-5 erhält drei zusätzliche Felder:

| Neues Feld | Typ | Beschreibung |
|---|---|---|
| `pdf_pfad` | Text (nullable) | Dateisystempfad zum gespeicherten PDF |
| `pdf_generiert_am` | Zeitstempel (nullable) | Wann das PDF zuletzt erstellt wurde |
| `pdf_versions_nr` | Integer (nullable) | Welche Berichtsversion als PDF vorliegt |

> **Warum diese drei Felder?** Sie ermöglichen es, sofort zu erkennen, ob das vorhandene PDF noch aktuell ist (Vergleich mit der aktuellen Versions-Nr). Ist die Berichtsversion neuer, wird ein „Neu generieren"-Hinweis angezeigt — kein blindes Re-Generieren bei jedem Download.

---

### API-Endpunkte

| Methode | Pfad | Zweck |
|---|---|---|
| `POST` | `/api/reports/[id]/export` | Startet PDF-Generierung serverseitig; gibt PDF-Metadaten zurück |
| `GET` | `/api/reports/[id]/download` | Liefert das gespeicherte PDF als Datei-Download |

**Ablauf POST /export:**
1. Lädt den JSONB-Snapshot der aktuellen Berichtsversion aus `berichts_versionen`
2. Ruft intern die Vorschau-Logik aus PROJ-5 auf (kein HTTP-Selbstaufruf)
3. Startet Puppeteer, rendert HTML → PDF mit eingebetteten Schriften
4. Speichert PDF unter `/var/reports/pdf/[report-id].pdf`
5. Aktualisiert `pdf_pfad`, `pdf_generiert_am`, `pdf_versions_nr` in der `berichte`-Tabelle
6. Antwortet mit Erfolg + Dateiname

**Ablauf GET /download:**
1. Liest `pdf_pfad` aus DB
2. Sendet Datei mit Header `Content-Disposition: attachment; filename=[Projektkuerzel]_Begehung_[YYYY-MM-DD].pdf`

---

### Technische Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| PDF-Engine | Puppeteer (headless Chromium) | Rendert identisches CSS wie der Browser; unterstützt modernes CSS (Flexbox, Grid, Custom Properties); `@media print` und `page-break`-Regeln funktionieren zuverlässig — wkhtmltopdf nutzt veraltetes WebKit ohne diese Unterstützung |
| Schriftart-Einbettung | Inter-Font liegt lokal auf dem Server | Puppeteer lädt Schriften aus dem Dateisystem, kein CDN-Aufruf zur Render-Zeit; PDF enthält eingebettete Schriften (kein Zeichensatz-Problem beim Öffnen) |
| Synchroner Ablauf | POST wartet auf Puppeteer-Abschluss (max. 30 s / 120 s bei >100 Fotos) | Einfachste zuverlässige Lösung; kein Job-Queue-System nötig im MVP; der Export-Dialog zeigt Progress-Animation während der Request läuft |
| PDF-Speicherung | Lokales Dateisystem (`/var/reports/pdf/`) | Konsistent mit PROJ-4 (Medien-Verwaltung); kein Cloud-Lock-in; DSGVO-konform (Daten bleiben auf eigenem Server) |
| Re-Use-Logik | Versions-Nr-Vergleich in DB | Kein unnötiges Re-Generieren; aber klarer Hinweis wenn Berichtsversion neuer als vorhandenes PDF |
| Fehlerbehandlung | Halb-generierte Datei wird gelöscht, DB-Felder bleiben null | Kein korruptes PDF auf dem Server; Nutzer kann jederzeit erneut versuchen |

---

### Paketabhängigkeiten

| Paket | Zweck |
|---|---|
| `puppeteer` | Headless Chromium für HTML→PDF-Konvertierung |

> **Hinweis zur Serverumgebung:** Puppeteer lädt beim ersten Start Chromium herunter (~170 MB). Für Docker-Deployments empfiehlt sich `puppeteer-core` mit einem vorinstallierten Chromium im Image.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
