# PROJ-12: Erweiterte Berichtsvorlagen

## Status: In Review
**Created:** 2026-04-21
**Last Updated:** 2026-04-30

## Dependencies
- Requires: PROJ-5 (Berichtsgenerierung) — Basis-Bericht muss existieren
- Requires: PROJ-6 (PDF-Export) — Templates wirken sich auf den PDF-Output aus

## Beschreibung
Admins können das Layout und Design der Berichte an das Corporate Design des Architekturbüros anpassen: Firmenlogo, Farbschema, Schriftarten, Kopf- und Fußzeilen-Inhalt. Mehrere Templates können angelegt und pro Projekt oder Berichtstyp zugewiesen werden. Ermöglicht professionelle, markengerechte Berichte ohne Code-Änderungen.

## User Stories
- Als **Admin** möchte ich das Firmenlogo in alle Berichte einbinden, damit Berichte unsere Corporate Identity widerspiegeln.
- Als **Admin** möchte ich Primär- und Sekundärfarben konfigurieren (z. B. für Überschriften), damit die Berichte visuell zu unserem Büro passen.
- Als **Admin** möchte ich mehrere Berichtsvorlagen anlegen (z. B. eine für Auftraggeber, eine für interne Zwecke), damit unterschiedliche Zielgruppen unterschiedliche Layouts erhalten.
- Als **Mitarbeiter** möchte ich beim Berichtsexport eine Vorlage auswählen, damit ich je nach Empfänger das passende Layout wählen kann.

## Acceptance Criteria
- [ ] Admin-Bereich: Template-Verwaltung (Anlegen, Bearbeiten, Löschen, Als Standard markieren)
- [ ] Konfigurierbare Elemente pro Template: Logo (PNG/SVG, max 2 MB), Firmenname, Primärfarbe (HEX), Sekundärfarbe (HEX), Kopfzeilen-Text, Fußzeilen-Text, Schriftgröße (klein/mittel/groß)
- [ ] Vorschau des Templates in Echtzeit (HTML-Rendering im Admin-UI)
- [ ] Standard-Template wird für alle neuen Berichte verwendet, außer ein Mitarbeiter wählt explizit ein anderes
- [ ] Template-Wechsel im Bericht-Editor möglich, ohne Inhalte zu verlieren
- [ ] Mindestens 2 mitgelieferte Default-Templates: „Professionell" (schlicht, schwarz-weiß) und „Modern" (mit Farbakzenten)
- [ ] Template-Änderungen wirken sich auf zukünftige Exports aus; bestehende PDFs bleiben unverändert

## Edge Cases
- Was passiert, wenn ein Template gelöscht wird, das noch Berichten zugeordnet ist? → Löschen wird verhindert mit Hinweis: „Dieses Template wird von X Berichten verwendet."
- Was passiert, wenn ein Logo-Bild zu groß für die Kopfzeile ist? → Automatische Skalierung auf max. 150px Höhe; Seitenverhältnis bleibt erhalten.
- Was passiert, wenn eine HEX-Farbe zu wenig Kontrast für lesbaren Text bietet? → Warnung im Admin-UI: „Dieser Farbwert könnte die Lesbarkeit beeinträchtigen." (kein Blockieren)

## Technical Requirements
- Templates werden in der Datenbank gespeichert (JSON-Konfiguration + Logo als Dateipfad)
- CSS-Variable-Injection: Template-Farben und Fonts werden als CSS-Variablen in die HTML-Vorlage injiziert
- Logo-Dateien: Gespeichert unter `/var/uploads/templates/[template-id]/logo.[ext]`
- API-Endpunkte: GET /templates, POST /templates, PUT /templates/:id, DELETE /templates/:id

---

## Tech Design (Solution Architect)

### Gewählter Ansatz: CSS-Variable-Injection in bestehende PROJ-5/PROJ-6-Pipeline

PROJ-5 rendert HTML-Berichte serverseitig; PROJ-6 konvertiert dieses HTML via Puppeteer zu PDF. PROJ-12 erweitert diese Pipeline: statt einer fixen Firmenlogo-Einstellung gibt es künftig **mehrere benannte Templates** in der Datenbank. Das gewählte Template wird als CSS Custom Properties (Variablen) serverseitig in das `<head>`-Tag injiziert — PROJ-5 und PROJ-6 bleiben strukturell unverändert, nur die Variablen wechseln.

---

### Komponentenstruktur

```
/admin/vorlagen                        (Admin-Bereich — nur für Admin-Rolle)
+-- VorlagenListe
    +-- VorlagenKarte (pro Template)
    |   +-- VorschauThumbnail          (Miniatur-Rendering des Templates)
    |   +-- Template-Name + StandardBadge
    |   +-- AktionenMenu               (shadcn/ui DropdownMenu)
    |       +-- BearbeitenOption
    |       +-- AlsStandardMarkierenOption
    |       +-- LöschenOption          (blockiert wenn Berichte referenzieren)
    +-- NeueVorlageButton              (shadcn/ui Button)

/admin/vorlagen/neu
/admin/vorlagen/[id]/bearbeiten
+-- VorlagenEditor                     (zweispaltig: Links Form, Rechts Vorschau)
    +-- LinkeSeite: Konfigurationsformular
    |   +-- LogoUploadBereich          (Drag & Drop, PNG/SVG, max 2 MB)
    |   |   +-- VorschauBild           (aktives Logo, skaliert auf 150px Höhe)
    |   |   +-- DateiEingabe           (shadcn/ui Input, type=file)
    |   +-- FirmennameEingabe          (shadcn/ui Input)
    |   +-- PrimärfarbeFeld            (shadcn/ui Input, type=color + HEX-Text)
    |   |   +-- KontrastWarnung        (shadcn/ui Alert — erscheint bei schlechtem Kontrast)
    |   +-- SekundärfarbeFeld          (shadcn/ui Input, type=color + HEX-Text)
    |   +-- KopfzeilenTextFeld         (shadcn/ui Input)
    |   +-- FußzeilenTextFeld          (shadcn/ui Input)
    |   +-- SchriftgrösseAuswahl       (shadcn/ui RadioGroup: klein / mittel / groß)
    |   +-- SpeichernButton            (shadcn/ui Button)
    |
    +-- RechteSeite: LiveVorschau
        +-- VorschauRahmen             (HTML-iframe mit aktuellem Template-CSS)
        +-- VorschauHinweis            ("Vorschau wird live aktualisiert")

/berichte/[id]                         (Erweiterung des Editors aus PROJ-5)
+-- BerichtsEditorHeader
    +-- VorlagenAuswahl                (shadcn/ui Select — wählt Template für Export)
    +-- PDFExportButton                (aus PROJ-6 — nutzt nun gewähltes Template)
```

---

### Datenmodell

**Neue Tabelle `berichts_vorlagen`** — ein Datensatz pro Template:

| Feld | Typ | Beschreibung |
|---|---|---|
| ID | UUID | Eindeutige Kennung |
| Name | Text | Anzeigename (z. B. „Professionell", „Modern") |
| Ist_Standard | Boolean | Genau ein Template ist Standard; wird automatisch verwendet |
| Logo_Pfad | Text (nullable) | Dateisystempfad: `/var/uploads/templates/[id]/logo.[ext]` |
| Firmenname | Text | Erscheint in Kopfzeile wenn kein Logo vorhanden |
| Primärfarbe | Text | HEX-Farbwert (z. B. `#1a1a2e`) |
| Sekundärfarbe | Text | HEX-Farbwert (z. B. `#e94560`) |
| Kopfzeilen_Text | Text | Freier Text für die Kopfzeile |
| Fußzeilen_Text | Text | Freier Text für die Fußzeile |
| Schriftgröße | Enum | `klein` (10pt) / `mittel` (12pt) / `groß` (14pt) |
| Erstellt_am | Zeitstempel | Automatisch |
| Geändert_am | Zeitstempel | Automatisch bei jeder Änderung |

**Erweiterung Tabelle `berichte`** (aus PROJ-5):

| Neues Feld | Typ | Beschreibung |
|---|---|---|
| `vorlage_id` | UUID (nullable, FK) | Verweist auf `berichts_vorlagen`; wenn leer → Standard-Template wird verwendet |

**Erweiterung JSONB-Snapshot in `berichts_versionen`** (aus PROJ-5):

Der bestehende Snapshot wird um einen `vorlage_snapshot`-Block erweitert:

```
{
  vorlage_snapshot: {
    name, logo_pfad, firmenname, primärfarbe,
    sekundärfarbe, kopfzeilen_text, fußzeilen_text, schriftgröße
  },
  deckblatt: { ... },
  abschnitte: [ ... ]
}
```

> **Warum ein Template-Snapshot?** Wenn ein Template nachträglich geändert wird, sehen bereits exportierte PDFs trotzdem noch gleich aus — die Template-Konfiguration zum Export-Zeitpunkt ist eingefroren. Konsistent mit der Snapshot-Philosophie aus PROJ-5.

---

### API-Endpunkte

| Methode | Pfad | Zweck |
|---|---|---|
| `GET` | `/api/templates` | Alle Templates laden (für Auswahl im Editor) |
| `POST` | `/api/templates` | Neues Template anlegen |
| `PUT` | `/api/templates/[id]` | Template-Konfiguration aktualisieren |
| `DELETE` | `/api/templates/[id]` | Template löschen (blockiert wenn Berichte referenzieren) |
| `POST` | `/api/templates/[id]/logo` | Logo-Datei hochladen; ersetzt vorhandenes Logo |
| `PUT` | `/api/templates/[id]/default` | Dieses Template als Standard markieren (alle anderen: `false`) |

**Erweiterung bestehender Endpunkte (PROJ-5 / PROJ-6):**

| Methode | Pfad | Änderung |
|---|---|---|
| `GET` | `/api/reports/[id]/preview` | Liest `vorlage_id` aus `berichte`, injiziert CSS-Variablen des Templates in HTML |
| `POST` | `/api/reports/[id]/export` | Liest Template aus `vorlage_id`, schreibt `vorlage_snapshot` in JSONB-Snapshot |

---

### Technische Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| CSS-Integration | CSS Custom Properties serverseitig in `<head>` injiziert | PROJ-5 und PROJ-6 bleiben strukturell unverändert; nur die Variablen wechseln; Puppeteer rendert sie identisch zum Browser |
| Template-Speicherung | JSONB-Konfiguration in DB + Logo als Datei auf Dateisystem | Konsistent mit PROJ-4 (lokales Dateisystem, DSGVO-konform); kein Cloud-Lock-in |
| Default-Template-Logik | DB-Flag `ist_standard` — genau ein Eintrag `true`, alle anderen `false` | Atomare Umschaltung; kein Race-Condition-Risiko |
| Lösch-Schutz | COUNT-Abfrage auf `berichte.vorlage_id` vor dem Löschen | Verhindert verwaiste Referenzen; klare Fehlermeldung mit Anzahl betroffener Berichte |
| Farbkontrast-Prüfung | WCAG-Luminanz-Berechnung serverseitig (keine externe Library) | Reine Mathematik auf HEX-Wert; warnt, blockiert aber nicht |
| LiveVorschau im Editor | HTML-`<iframe>` wird bei Formularänderungen live aktualisiert | Sofortiges Feedback ohne Page-Reload; iframe isoliert Template-CSS von Admin-UI |
| 2 Default-Templates | Als Datenbankmigrierung geseedete Einträge (nicht hartcodiert) | Können durch Admin angepasst werden; sind normale `berichts_vorlagen`-Einträge |
| Logo-Skalierung | CSS `max-height: 150px; width: auto` im Print-Stylesheet | Browser-Standard; kein serverseitiges Bildprocessing; Seitenverhältnis automatisch erhalten |

---

### Paketabhängigkeiten

Keine neuen Pakete erforderlich — alle benötigten Funktionen sind bereits vorhanden:

| Verfügbar | Woher |
|---|---|
| Datei-Upload | PROJ-4 (Medien-Verwaltung) hat Upload-Logik bereits |
| CSS-Variablen-Injection | PROJ-5 HTML-Renderer (serverseitig) |
| PDF-Rendering | PROJ-6 Puppeteer-Pipeline |
| UI-Komponenten | shadcn/ui (alle bereits installiert) |

---

### Ablaufdiagramm: Template-Auswahl beim PDF-Export

```
Mitarbeiter öffnet Bericht
         ↓
Wählt Template in BerichtsEditorHeader (oder: Standard-Template greift)
         ↓
Klickt PDF-Export (PROJ-6)
         ↓
Server liest vorlage_id aus berichte-Tabelle
         ↓
Server lädt Template-Konfiguration aus berichts_vorlagen
         ↓
Injiziert CSS-Variablen in HTML-Vorschau (PROJ-5 Renderer)
         ↓
Puppeteer rendert HTML → PDF (PROJ-6 Pipeline)
         ↓
vorlage_snapshot wird im JSONB-Snapshot eingefroren
         ↓
PDF steht zum Download bereit
```

## Implementation Notes

### Was gebaut wurde
- **Supabase-Migration** `20260424_proj12_berichts_vorlagen.sql`: Neue `berichts_vorlagen`-Tabelle mit RLS; `vorlage_id`-FK in `berichte`; 2 Default-Templates geseedet ("Professionell", "Modern").
- **Types** (`src/types/berichte.ts`): `VorlageConfig`, `VorlageSnapshot` hinzugefügt; `BerichtsSnapshot` um optionales `vorlage_snapshot` erweitert; `Bericht` um `vorlage_id` erweitert.
- **Renderer** (`src/lib/bericht-renderer.ts`): `renderBerichtHTML` akzeptiert optionalen `VorlageSnapshot`-Parameter; injiziert CSS Custom Properties (`--farbe-primaer`, `--farbe-sekundaer`, `--schrift-basis`) in `<head>`; rendert Kopfzeile, Fußzeile und Logo/Firmenname aus Template.
- **API `GET/POST /api/templates`**: Alle Templates laden; neues Template anlegen (Admin). Zod-validiert.
- **API `GET/PUT/DELETE /api/templates/[id]`**: Template laden, aktualisieren, löschen. Lösch-Schutz: blockiert wenn Berichte referenzieren. Standard-Template kann nicht gelöscht werden.
- **API `POST/GET/DELETE /api/templates/[id]/logo`**: Logo hochladen (PNG/SVG/JPEG/WEBP, max 2 MB), ausliefern, entfernen.
- **API `PUT /api/templates/[id]/default`**: Template als Standard markieren.
- **API `PATCH /api/reports/[id]`**: `vorlage_id` ohne neue Version setzen.
- **Preview** (`/api/reports/[id]/preview`): Liest `vorlage_id` aus `berichte`, lädt Template, injiziert `logo_url` als HTTP-URL für den Browser.
- **Export** (`/api/reports/[id]/export`): Lädt Template, bettet Logo als Base64-Data-URI ein (für Puppeteer), friert `vorlage_snapshot` in JSONB ein.
- **Admin-Seite** `/admin/vorlagen`: Liste aller Templates mit Farbstreifen-Karte; Standardmarkierung; Löschen mit Bestätigungsdialog.
- **Admin-Seiten** `/admin/vorlagen/neu` und `/admin/vorlagen/[id]/bearbeiten`: Zweispaltiger Editor — Links: Formular (Name, Logo, Farben, Texte, Schriftgröße); Rechts: Live-Vorschau im iframe mit WCAG-Kontrast-Warnung bei schlechter Lesbarkeit.
- **Bericht-Editor**: `VorlageAuswahl`-Komponente im Header; Template-Wechsel speichert `vorlage_id` per PATCH ohne neue Version.
- **`.env.local.example`**: `TEMPLATE_UPLOAD_PATH` dokumentiert.

### Abweichungen vom Tech Design
- Logo in Puppeteer wird als Base64-Data-URI eingebettet statt als `file://`-URL, um Dateisystem-Pfad-Probleme zu vermeiden.
- Die Live-Vorschau im Editor rendert client-seitig (kein separater API-Aufruf) für sofortiges Feedback.
- `PATCH /api/reports/[id]` neu für `vorlage_id` statt Erweiterung des PUT (der eine neue Version anlegt).

## QA Test Results

**QA Datum:** 2026-04-30
**Status:** NOT READY — 1 High + 1 Medium Security Bug

### Automated Tests
- **Vitest (Unit):** 256 Tests — alle grün (31 neue Tests für PROJ-12 hinzugefügt)
  - `src/app/api/templates/route.test.ts` — 11 Tests (GET list, POST create)
  - `src/app/api/templates/[id]/route.test.ts` — 12 Tests (GET, PUT, DELETE inkl. Lösch-Schutz)
  - `src/app/api/templates/[id]/default/route.test.ts` — 4 Tests (PUT set-default)
  - `src/lib/bericht-renderer.test.ts` — 8 neue Tests (vorlage_snapshot Fallback, XSS in Vorlage-Feldern)
- **Playwright (E2E):** 24 Tests in `tests/PROJ-12-erweiterte-berichtsvorlagen.spec.ts`
  - 3 bestanden (unauthentifizierte Weiterleitungen)
  - 21 übersprungen (require Supabase-Session — erwartetes Verhalten)
  - 0 fehlgeschlagen
- **Regression:** Alle 32 bestehenden E2E-Tests — keine Regressionen

### Acceptance Criteria

| # | Kriterium | Status | Anmerkung |
|---|-----------|--------|-----------|
| AC-1 | Admin-Bereich: Template-Verwaltung (Anlegen, Bearbeiten, Löschen, Standard) | ✅ PASS | Alle CRUD-Operationen implementiert; Lösch-Schutz und Standard-Schutz funktionieren |
| AC-2 | Konfigurierbare Elemente: Logo, Firmenname, Primärfarbe, Sekundärfarbe, Kopfzeile, Fußzeile, Schriftgröße | ✅ PASS | Alle Felder vorhanden; Logo akzeptiert PNG/SVG/JPEG/WEBP max 2 MB |
| AC-3 | Vorschau des Templates in Echtzeit (HTML-Rendering im iframe) | ✅ PASS | Live-Vorschau via iframe, client-seitig aktualisiert bei jeder Formularänderung |
| AC-4 | Standard-Template für alle neuen Berichte | ✅ PASS | `ist_standard`-Flag in DB; Export-Route verwendet Standard als Fallback |
| AC-5 | Template-Wechsel im Bericht-Editor ohne Inhaltsverlust | ⚠️ PARTIAL | PATCH-Endpunkt korrekt implementiert; **aber**: Fehler beim PATCH werden nicht dem Nutzer angezeigt (BUG-HIGH-1) |
| AC-6 | Mindestens 2 Default-Templates: „Professionell" und „Modern" | ✅ PASS | Beide Templates per Migration geseedet |
| AC-7 | Template-Änderungen wirken auf zukünftige Exports; bestehende PDFs unverändert | ✅ PASS | `vorlage_snapshot` wird beim Export in JSONB eingefroren |

### Edge Cases

| Edge Case | Status | Anmerkung |
|-----------|--------|-----------|
| Template mit referenzierten Berichten kann nicht gelöscht werden | ✅ PASS | COUNT-Abfrage auf `berichte.vorlage_id`; 409 mit Anzahl |
| Standard-Template kann nicht gelöscht werden | ✅ PASS | Separater `ist_standard`-Check; 409 mit Hinweis |
| Logo zu groß für Kopfzeile → automatische Skalierung | ✅ PASS | CSS `max-height: 150px` im Print-Stylesheet; Seitenverhältnis erhalten |
| HEX-Farbe mit schlechtem Kontrast → Warnung (kein Block) | ✅ PASS | WCAG-Luminanz-Berechnung client-seitig; Amber-Warnung bei Kontrast < 4.5:1 |

### Security Audit

| Befund | Schwere | Details |
|--------|---------|---------|
| BUG-SEC-1: `GET /api/templates/[id]/logo` ohne Auth | **Medium** | Logo-Datei ist ohne Authentifizierung abrufbar wenn UUID bekannt. Firmenlogos sind sensible Corporate Assets. Betrifft: [src/app/api/templates/[id]/logo/route.ts](src/app/api/templates/%5Bid%5D/logo/route.ts) Zeile 26 |
| WCAG-Kontrast-Check nur für Primärfarbe | Low | Sekundärfarbe nicht geprüft — entspricht aber der Spec |
| CSS-Injection in Vorschau-iframe | Low | `kopfzeilenText`/`firmenname` nicht HTML-escaped in generatePreviewHtml(). Mitigiert durch `sandbox="allow-same-origin"` (kein Script-Execution). Betrifft: [src/components/vorlagen/VorlagenEditor.tsx](src/components/vorlagen/VorlagenEditor.tsx) Zeile 103/107/113 |
| RLS: Service-Rolle hat vollen Schreibzugriff | Akzeptiert | Konsistent mit anderen Tabellen im Projekt |

### Bugs

#### BUG-HIGH-1 — VorlageAuswahl: Stille PATCH-Fehler, kein User-Feedback
- **Schwere:** High
- **Datei:** [src/components/vorlagen/VorlageAuswahl.tsx](src/components/vorlagen/VorlageAuswahl.tsx) Zeile 36–47
- **Beschreibung:** Wenn `PATCH /api/reports/[id]` beim Template-Wechsel fehlschlägt (Netzwerkfehler, 500), zeigt die UI den neuen Template-Namen, aber die DB speichert den alten. Beim nächsten PDF-Export verwendet der Server das alte Template — der Nutzer erhält das falsche Layout ohne Warnung.
- **Steps to Reproduce:**
  1. Bericht öffnen, Template in der Auswahl wechseln
  2. PATCH-Request per DevTools blockieren
  3. PDF exportieren → falsches Template wird verwendet
- **Fix:** `try/catch` um den PATCH-Aufruf erweitern; bei Fehler Selektion zurücksetzen und Fehler-Toast anzeigen

#### BUG-MED-1 — Lösch-Fehlermeldung außerhalb des Dialog-Kontexts
- **Schwere:** Medium
- **Datei:** [src/components/vorlagen/VorlagenKarte.tsx](src/components/vorlagen/VorlagenKarte.tsx) Zeile 172–174
- **Beschreibung:** Wenn DELETE 409 zurückgibt (Vorlage von Berichten referenziert), schließt der AlertDialog und die Fehlermeldung erscheint als `<p>` unterhalb der Karte — außerhalb der Card-Grenzen, kaum sichtbar im Grid-Layout.
- **Fix:** Fehlermeldung innerhalb des AlertDialogs anzeigen (vor dem Schließen) oder als Toast-Notification

#### BUG-MED-2 — `GET /api/templates` fehlt `.limit()`
- **Schwere:** Medium (Backend-Convention-Verletzung)
- **Datei:** [src/app/api/templates/route.ts](src/app/api/templates/route.ts) Zeile 25–29
- **Beschreibung:** Backend-Regeln schreiben `.limit()` bei allen List-Queries vor. Fehlt im Template-List-Endpunkt.
- **Fix:** `.limit(100)` nach `.order('erstellt_am', { ascending: true })` einfügen

#### BUG-SEC-1 — `GET /api/templates/[id]/logo` ohne Authentifizierung
- **Schwere:** Medium (Security)
- **Datei:** [src/app/api/templates/[id]/logo/route.ts](src/app/api/templates/%5Bid%5D/logo/route.ts) Zeile 26
- **Beschreibung:** Der GET-Handler prüft keine Authentifizierung. Jeder mit einer Template-UUID kann das Logo herunterladen, ohne eingeloggt zu sein.
- **Fix:** `requireAuth()` am Anfang des GET-Handlers hinzufügen

### Responsive Testing

| Viewport | Seite | Status |
|----------|-------|--------|
| 1440px (Desktop) | /admin/vorlagen | ✅ — Karten-Grid, zweispaltig |
| 768px (Tablet) | /admin/vorlagen | ✅ — Responsive Grid |
| 375px (Mobile) | /admin/vorlagen | ✅ — Einspaltig |
| 1440px (Desktop) | /admin/vorlagen/neu | ✅ — Zweispaltiger Editor (Form + Preview) |
| 768px (Tablet) | /admin/vorlagen/neu | ✅ — Editor-Felder sichtbar |

### Cross-Browser

Tests laufen nur in Chromium (kein echtes Auth-Session für Firefox/Safari-Tests). Chromium-Ergebnisse als repräsentativ.

### Production-Ready Entscheidung

**❌ NOT READY** — 1 High-Bug und 1 Medium-Security-Bug offen.

**Muss behoben werden vor Deployment:**
1. BUG-HIGH-1: VorlageAuswahl stille PATCH-Fehler
2. BUG-SEC-1: Logo-Endpoint ohne Auth

**Kann nach Deployment behoben werden:**
3. BUG-MED-1: Lösch-Fehlermeldung Positioning
4. BUG-MED-2: Fehlende `.limit()` in GET /api/templates

## Deployment
_To be added by /deploy_
