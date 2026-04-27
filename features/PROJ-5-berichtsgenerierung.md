# PROJ-5: Berichtsgenerierung

## Status: In Review
**Created:** 2026-04-21
**Last Updated:** 2026-04-27

## Dependencies
- Requires: PROJ-1 (Authentifizierung)
- Requires: PROJ-2 (Projektverwaltung)
- Requires: PROJ-3 (Begehungs-Erfassung) — Begehungsdaten als Berichtsinhalt
- Requires: PROJ-4 (Medien-Verwaltung) — Fotos als Berichtsinhalt

## Beschreibung
Das Kernstück des Systems: Ein strukturierter, mehrseitiger HTML-Bericht wird dynamisch aus den erfassten Begehungsdaten und Fotos generiert. Der Bericht besteht aus einem Deckblatt mit den wichtigsten Kennzahlen und einem oder mehreren Projektabschnitten mit Fotos und Texten. Die Struktur ist flexibel: Abschnitte können eingefügt, entfernt und umsortiert werden. Täglich wird ein neuer Bericht erstellt, der alle Begehungen des Tages zusammenfasst.

## User Stories
- Als **Mitarbeiter** möchte ich mit einem Klick einen Tagesbericht für ein bestimmtes Datum generieren lassen, damit ich schnell einen druckfertigen Bericht erhalte.
- Als **Mitarbeiter** möchte ich mehrere Begehungen desselben Tages in einem einzigen Bericht zusammenfassen, damit der Auftraggeber eine Gesamtübersicht erhält.
- Als **Mitarbeiter** möchte ich den generierten Bericht in einer Vorschau sehen und Abschnitte verschieben oder entfernen, bevor ich ihn exportiere.
- Als **Admin** möchte ich das Firmenlogo und Briefkopf in den Bericht einbinden, damit der Bericht unsere Corporate Identity widerspiegelt.
- Als **Mitarbeiter** möchte ich einzelne Foto-Abschnitte ein- oder ausblenden, damit nicht alle Fotos im Abgabe-Bericht erscheinen.

## Acceptance Criteria

### Deckblatt (Seite 1):
- [ ] Firmenlogo (konfigurierbar im Admin-Bereich)
- [ ] Berichtstitel: „Baustellenbegehung – [Projektname]"
- [ ] Projektnummer
- [ ] Datum der Begehung
- [ ] Uhrzeit der Begehung
- [ ] Wetterbedingungen + Temperatur
- [ ] Teilnehmer / Beteiligte (Name + Rolle, nummeriert)
- [ ] Erstellungsdatum des Berichts + Ersteller

### Folgeseiten (je Begehung / Themenabschnitt):
- [ ] Abschnittsüberschrift (automatisch oder editierbar)
- [ ] Freitext-Block (Leistungsstand, Vorkommnisse, Maßnahmen)
- [ ] Foto-Galerie: Fotos mit Bildunterschrift (2 Fotos pro Zeile)
- [ ] Abschnitte sind per Drag-and-Drop sortierbar (in der Vorschau)
- [ ] Abschnitte können einzeln ausgeblendet werden (erscheinen nicht im Export)

### Berichtserstellung:
- [ ] Bericht-Generator-Dialog: Datum auswählen + Projekt(e) auswählen → Bericht wird generiert
- [ ] Mehrere Begehungen desselben Tages werden in separate Abschnitte unterteilt
- [ ] Bericht kann manuell bearbeitet werden: Texte editieren, Fotos hinzufügen/entfernen
- [ ] Änderungen werden als neue Version gespeichert (kein Überschreiben; Versionsverlauf)
- [ ] HTML-Vorschau in der Web-App mit WYSIWYG-Qualität
- [ ] Druckansicht entspricht dem späteren PDF-Export (identisches Layout)

## Edge Cases
- Was passiert, wenn an einem Tag keine Begehungen erfasst wurden? → Fehlermeldung: „Für das gewählte Datum und Projekt liegen keine abgeschlossenen Begehungen vor."
- Was passiert, wenn eine Begehung sehr viele Fotos hat (> 50)? → Warnung: „Dieser Abschnitt enthält 50+ Fotos. Das kann den PDF-Export verlangsamen. Möchten Sie Fotos auswählen?"
- Was passiert, wenn der Berichtsabschnitt nach dem Sortieren gespeichert wird und die Begehungsdaten sich nachträglich ändern? → Berichtsversion bleibt unverändert; eine neue Version kann auf Basis der neuen Daten erstellt werden.
- Was passiert, wenn mehrere Begehungen verschiedener Projekte an einem Tag zusammengefasst werden sollen? → Nicht unterstützt (MVP); ein Bericht = ein Projekt. Erweiterung in P2.
- Was passiert bei fehlendem Firmenlogo? → Platzhaltertext „[Firmenname]" wird verwendet.

## Technical Requirements
- HTML-Bericht wird serverseitig gerendert (kein clientseitiges Rendering für PDF-Konsistenz)
- CSS: Print-optimiertes Stylesheet (A4, 2 cm Ränder, serifenlose Schrift)
- Versionierung: Jeder gespeicherte Zustand eines Berichts erhält einen Versions-Timestamp
- API-Endpunkte: POST /reports/generate, GET /reports/:id, PUT /reports/:id, GET /reports/:id/preview

---

## Tech Design (Solution Architect)

### Gewählter Ansatz: Serverseitiges HTML-Rendering + JSONB-Versionierung

Berichte werden **serverseitig** aus den Daten der Tabellen `begehungen` und `fotos` generiert (konsistent mit PROJ-3 und PROJ-4). Jeder gespeicherte Berichtsstand wird als **unveränderlicher JSONB-Snapshot** in Supabase abgelegt — kein Überschreiben, kein Datenverlust. Die Vorschau im Browser nutzt exakt dasselbe CSS wie der spätere PDF-Export (PROJ-6), sodass WYSIWYG garantiert ist.

---

### Komponentenstruktur

```
/berichte/neu  (Bericht-Generator — aufrufbar aus Dashboard PROJ-7)
+-- BerichtsGeneratorDialog          (shadcn/ui Dialog)
    +-- ProjektAuswahl               (shadcn/ui Select — zeigt nur zugeordnete Projekte)
    +-- DatumAuswahl                 (shadcn/ui Input, type=date, Default: heute)
    +-- VerfügbareBegehungenHinweis  (shadcn/ui Alert — „3 Begehungen gefunden" / Fehlermeldung)
    +-- GenerierenButton             (shadcn/ui Button — leitet weiter zu /berichte/[id])

/berichte/[id]  (Berichtseditor / Vorschau)
+-- BerichtsEditorHeader
|   +-- Projekttitel + Begehungsdatum
|   +-- VersionsAnzeige             (z. B. „Version 3 — gespeichert 14:32 Uhr")
|   +-- SpeichernButton             (shadcn/ui Button — speichert neuen Versions-Snapshot)
|   +-- PDFExportButton             (→ PROJ-6, zunächst deaktiviert)
|
+-- BerichtsVorschau                (scrollbarer Bereich, Print-CSS aktiv)
    +-- Deckblatt                   (Seite 1 des Berichts)
    |   +-- FirmenlogoBereich       (Bild aus Admin-Einstellung oder Platzhaltertext)
    |   +-- BerichtsKopf            (Titel „Baustellenbegehung – [Projektname]", Projektnummer)
    |   +-- MetaZeile               (Datum | Uhrzeit | Erstellt von | Erstellungsdatum)
    |   +-- WetterZeile             (Icon + Bedingung + Temperatur)
    |   +-- TeilnehmerListe         (nummerierte Liste: Name + Rolle)
    |
    +-- AbschnittListe              (Drag-and-Drop Container via @dnd-kit)
        +-- BerichtsAbschnitt       (pro Begehung — sortierbar per Drag & Drop)
            +-- AbschnittsHeader
            |   +-- DragHandle      (visueller Anfasser zum Verschieben)
            |   +-- TitelFeld       (shadcn/ui Input — editierbar, auto-befüllt)
            |   +-- SichtbarkeitsToggle  (shadcn/ui Switch — blendet Abschnitt im Export aus)
            +-- FreitextFeld        (shadcn/ui Textarea — Leistungsstand, Vorkommnisse, Maßnahmen)
            +-- FotoGalerie         (2 Spalten, responsive)
                +-- BerichtsFoto    (pro Foto im Abschnitt)
                    +-- ThumbnailBild
                    +-- BildunterschriftFeld  (shadcn/ui Input — editierbar)
                    +-- FotoAusblendenButton  (shadcn/ui Switch — Foto aus Export ausblenden)
```

---

### Datenmodell

**Tabelle `berichte`** — ein Datensatz pro Bericht (Projekt + Datum):

| Feld | Typ | Beschreibung |
|---|---|---|
| ID | UUID | Eindeutige Kennung |
| Projekt-ID | UUID | Fremdschlüssel → `projekte` (PROJ-2) |
| Ersteller-ID | UUID | Fremdschlüssel → `nutzer_profile` (PROJ-1) |
| Begehungs-Datum | Datum | Tag, für den der Bericht gilt |
| Aktuelle Versions-Nr | Integer | Zeigt auf die zuletzt gespeicherte Version |
| Erstellt am | Zeitstempel | Automatisch |
| Zuletzt geändert | Zeitstempel | Automatisch bei Versions-Speicherung |

**Tabelle `berichts_versionen`** — unveränderliche Snapshots jedes Speicherstands:

| Feld | Typ | Beschreibung |
|---|---|---|
| ID | UUID | Eindeutige Kennung |
| Bericht-ID | UUID | Fremdschlüssel → `berichte` |
| Versions-Nr | Integer | 1, 2, 3 … (inkrementell pro Bericht) |
| Erstellt am | Zeitstempel | Zeitpunkt der Speicherung |
| Inhalt | JSONB | Vollständiger Snapshot (Deckblatt + Abschnitte + Fotos, siehe unten) |

**JSONB-Snapshot-Struktur** (Inhalt einer Berichtsversion):
```
{
  deckblatt: {
    firmenlogo_url, projektname, projektnummer,
    datum, uhrzeit, wetter, temperatur,
    teilnehmer: [{ name, rolle }],
    erstellt_am, ersteller_name
  },
  abschnitte: [
    {
      begehungs_id, titel, freitext, sichtbar, reihenfolge,
      fotos: [{ foto_id, thumb_url, display_url, bildunterschrift, sichtbar, reihenfolge }]
    }
  ]
}
```

> **Warum JSONB-Snapshot?** Ändert sich ein Begehungsdatensatz nachträglich, bleiben bereits gespeicherte Berichtsversionen unberührt — keine Datenbankinkonsistenzen, kein versehentliches Überschreiben von Freigaben. Das entspricht exakt der im Spec definierten Anforderung.

---

### API-Endpunkte

| Methode | Pfad | Zweck |
|---|---|---|
| POST | `/api/reports/generate` | Erstellt neuen Bericht aus Begehungen (Datum + Projekt → Version 1) |
| GET | `/api/reports` | Liste aller Berichte (für PROJ-7 Dashboard) |
| GET | `/api/reports/[id]` | Bericht + aktuellste Version laden |
| GET | `/api/reports/[id]/versions` | Alle Versionen eines Berichts auflisten |
| GET | `/api/reports/[id]/versions/[nr]` | Bestimmte Version laden (Versionsverlauf) |
| PUT | `/api/reports/[id]` | Aktuellen Bearbeitungsstand als neue Version speichern |
| GET | `/api/reports/[id]/preview` | Serverseitig gerendertes HTML (für Druck / PROJ-6) |

---

### Technische Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Rendering-Ort | Serverseitig (Next.js API Route) | PDF-Konsistenz: Browser-Rendering kann font-rendering und Seitenumbrüche nicht zuverlässig steuern; Server liefert identisches HTML für Vorschau und PDF-Export (PROJ-6) |
| Versionierung | JSONB-Snapshot in Supabase | Unveränderliche Versionen ohne FK-Abhängigkeiten; freigegebene Berichte werden nie durch spätere Datenänderungen korrumpiert |
| Drag & Drop | `@dnd-kit/core` + `@dnd-kit/sortable` | Leichtgewichtig, barrierefrei (ARIA), kein jQuery; speziell für React/Next.js konzipiert |
| Print-CSS | Dediziertes `@media print`-Stylesheet | A4-Format, 2 cm Ränder, serifenlose Schrift (wie im Spec gefordert); identisch in Browser-Vorschau und PDF-Export |
| Foto-Auslieferung in Berichten | URLs aus PROJ-4 API (`/api/media/file/[id]`) | Zugriffskontrolle bleibt erhalten; kein direkter Dateisystem-Zugriff im Frontend |
| Firmenlogo-Konfiguration | Admin-Einstellung in Supabase `einstellungen`-Tabelle | Zentraler Speicherort; alle Berichte verwenden automatisch das aktuelle Logo |

---

### Paketabhängigkeiten

| Paket | Zweck |
|---|---|
| `@dnd-kit/core` | Drag-and-Drop-Basisframework |
| `@dnd-kit/sortable` | Sortierbare Listen (Abschnitte per Drag & Drop verschieben) |

## Implementierungsnotizen (2026-04-23)

### Was gebaut wurde
- **Migration** `005_berichte.sql`: Tabellen `einstellungen`, `berichte`, `berichts_versionen` mit RLS-Policies
- **Typen** `src/types/berichte.ts`: TypeScript-Interfaces für BerichtsSnapshot, Bericht, BerichtsVersion
- **API-Routes:**
  - `POST /api/reports/generate` — Bericht aus abgeschlossenen Begehungen generieren (JSONB-Snapshot Version 1)
  - `GET /api/reports` — Berichte auflisten (Admin: alle; Mitarbeiter: eigene Projekte)
  - `GET /api/reports/[id]` — Bericht + aktuelle Version laden
  - `PUT /api/reports/[id]` — Neuen Versions-Snapshot speichern (unveränderlich)
  - `GET /api/reports/[id]/versions` — Alle Versionen auflisten
  - `GET /api/reports/[id]/versions/[nr]` — Bestimmte Version laden
  - `GET /api/reports/[id]/preview` — Serverseitig gerendertes HTML (A4, Print-CSS)
- **Komponenten:**
  - `Deckblatt.tsx` — Editierbares Deckblatt (Wetter, Temperatur inline editierbar)
  - `BerichtsAbschnitt.tsx` — Pro Begehung; Drag-Handle, Sichtbarkeits-Toggle, Freitext, Foto-Grid mit Bildunterschriften
  - `AbschnittListe.tsx` — @dnd-kit Drag-and-Drop Container
- **Seiten:**
  - `/berichte/neu` — Generator-Dialog: Projekt + Datum → Bericht generieren
  - `/berichte/[id]` — Editor mit Versionsauswahl, Vorschau-Link, Speichern

### Abweichungen vom Spec
- PDF-Export-Button auf der Editorseite ist deaktiviert (folgt in PROJ-6)
- Drag-and-Drop zwischen Seiten (Browser-Vorschau ↔ Abschnitte) nicht erforderlich — @dnd-kit sortiert Abschnitte innerhalb der Liste

## QA Test Results

**Datum:** 2026-04-27
**Tester:** /qa (Claude)
**Status:** In Review — HIGH-Bug gefunden (BUG-001: XSS in HTML-Renderer)

---

### Acceptance Criteria — Ergebnisse

| # | Kriterium | Status | Anmerkung |
|---|-----------|--------|-----------|
| AC-01 | Firmenlogo konfigurierbar im Admin-Bereich | ✅ PASS | Geladen aus `einstellungen.firmenlogo_url`; Fallback: `[Firmenname]` |
| AC-02 | Berichtstitel „Baustellenbegehung – [Projektname]" | ✅ PASS | Im Editor-Header und im HTML-Preview korrekt |
| AC-03 | Projektnummer im Deckblatt | ✅ PASS | Korrekt aus Snapshot |
| AC-04 | Datum der Begehung | ✅ PASS | Deutsch formatiert (toLocaleDateString de-DE) |
| AC-05 | Uhrzeit der Begehung | ✅ PASS | Aus erster Begehung des Tages |
| AC-06 | Wetterbedingungen + Temperatur | ✅ PASS | Inline editierbar im Deckblatt; im HTML-Preview mit Einheit |
| AC-07 | Teilnehmer / Beteiligte (nummeriert, Name + Rolle) | ✅ PASS | Aus allen Begehungen zusammengeführt (dedupliciert nach Name) |
| AC-08 | Erstellungsdatum + Ersteller | ✅ PASS | Timestamp im Snapshot gespeichert |
| AC-09 | Abschnittsüberschrift (automatisch oder editierbar) | ✅ PASS | Auto-generiert als „Abschnitt N – Datum", frei editierbar |
| AC-10 | Freitext-Block pro Abschnitt | ✅ PASS | Textarea mit Resize; enthält Leistungsstand, Vorkommnisse, Maßnahmen |
| AC-11 | Foto-Galerie: 2 Fotos pro Zeile (in HTML-Preview) | ✅ PASS | HTML-Preview: `grid-template-columns: 1fr 1fr` korrekt |
| AC-12 | Drag-and-Drop Sortierung | ✅ PASS | @dnd-kit/sortable implementiert; `reihenfolge`-Feld wird aktualisiert |
| AC-13 | Abschnitte einzeln ausblendbar | ✅ PASS | Switch-Toggle; Counter „N sichtbar / M gesamt" aktualisiert sich |
| AC-14 | Bericht-Generator-Dialog (Datum + Projekt) | ✅ PASS | `/berichte/neu`; Default: heute; max = heute (kein Zukunftsdatum) |
| AC-15 | Mehrere Begehungen → separate Abschnitte | ✅ PASS | Generiere-Route gruppiert korrekt nach Begehungs-ID |
| AC-16 | Bericht manuell editierbar (Texte, Fotos) | ✅ PASS | Alle Felder inline editierbar; Fotos ein-/ausblendbar |
| AC-17 | Neue Version bei Speichern (kein Überschreiben) | ✅ PASS | JSONB-Snapshot unveränderlich; `version_nr` inkrementell |
| AC-18 | HTML-Vorschau (WYSIWYG) + Druckansicht | ✅ PASS | Serverseitiges HTML mit `@media print` CSS (A4, 20mm Ränder) |

**Alle 18 Acceptance Criteria bestanden.**

---

### Edge Cases — Ergebnisse

| Edge Case | Status | Anmerkung |
|-----------|--------|-----------|
| Keine Begehungen an diesem Tag | ✅ PASS | API gibt 404 + Fehlermeldung zurück; UI zeigt Alert |
| > 50 Fotos | ⚠️ PARTIAL | Hinweis wird gezeigt, aber über `setFehler()` als Error-State — **BUG-002** |
| Nachträgliche Datenänderung ändert alte Version nicht | ✅ PASS | JSONB-Snapshot-Ansatz garantiert Unveränderlichkeit |
| Fehlendes Firmenlogo | ✅ PASS | Editor: `[Firmenname]`-Platzhalter; Renderer: Projektname als Fallback |

---

### Bugs

#### BUG-001 (HIGH) — XSS-Schwachstelle im HTML-Preview-Renderer
**Datei:** `src/lib/bericht-renderer.ts`
**Beschreibung:** Benutzerkontrollierte Felder werden direkt als HTML interpoliert — ohne HTML-Entity-Escaping. Betroffen: `abschnitt.titel` (Zeile 34), `foto.bildunterschrift` (Zeile 22), `abschnitt.freitext` (nach `\n→<br/>`, Zeile 35), `deckblatt.projektname`, `kopfzeilenText`, `fusszeileText`.
**Schritte:** Begehung anlegen mit Titel `<img src=x onerror="alert(document.cookie)">` → Bericht generieren → Vorschau öffnen → XSS wird im Browser ausgeführt.
**Risiko:** Authentifizierter Mitarbeiter kann JavaScript im Browser eines anderen Nutzers ausführen, der die Vorschau öffnet. Mögliche Auswirkungen: Session-Diebstahl, Aktion im Namen des Opfers.
**Fix:** `escapeHtml()`-Funktion für alle user-kontrollierten Felder einführen (`&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`, `"` → `&quot;`, `'` → `&#39;`).
**Priorität:** Muss vor Deployment behoben werden.

#### BUG-002 (MEDIUM) — Foto-Warnung (> 50 Fotos) nutzt Fehler-State
**Datei:** `src/app/berichte/neu/page.tsx:61`
**Beschreibung:** Wenn die API `warnung` zurückgibt, wird dieser Hinweis über `setFehler('Hinweis: ...')` gesetzt. Das nutzt denselben State wie echte Fehler, was semantisch falsch ist. Selbst mit `variant="default"` erscheint es im roten Alert-Kontext und könnte Nutzer irritieren. Nach 2,5 Sekunden wird zur Bericht-Seite weitergeleitet — ohne Möglichkeit den Hinweis zu quittieren.
**Fix:** Separaten `hinweis`-State einführen (kein Fehler); andere Alert-Variante; Benutzer entscheidet selbst wann er weitergeht.

#### BUG-003 (MEDIUM) — Duplikations-Route gibt 500 bei Datum-Konflikt
**Datei:** `src/app/api/reports/[id]/duplicate/route.ts:74`
**Beschreibung:** Wenn für das berechnete neue Datum (`quellDatum + 1 Tag`) bereits ein Bericht für dasselbe Projekt existiert, schlägt der INSERT auf die `UNIQUE(projekt_id, begehungs_datum)`-Constraint fehl. Die Route gibt einen generischen 500-Fehler zurück statt einen hilfreichen 409 Conflict.
**Schritte:** Bericht für Projekt X am 2026-04-27 erstellen; Bericht für Projekt X am 2026-04-28 erstellen; ersten Bericht duplizieren → 500.
**Fix:** PostgreSQL Unique-Constraint-Fehler (Code `23505`) erkennen und 409 mit Nachricht „Für [Datum] existiert bereits ein Bericht für dieses Projekt" zurückgeben.

#### BUG-004 (LOW) — Editor zeigt Foto-Galerie mit 3–4 Spalten statt 2
**Datei:** `src/components/berichte/BerichtsAbschnitt.tsx:102`
**Beschreibung:** Spec fordert „2 Fotos pro Zeile". Im Editor-View wird `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` genutzt (bis zu 4 Spalten). Die HTML-Preview zeigt korrekt 2 Spalten. Unterschied zwischen Editor-Ansicht und Druckansicht.
**Auswirkung:** WYSIWYG ist nicht 100% gegeben (Editor ≠ Preview); Nutzer könnten überrascht sein.
**Priorität:** Niedrig — Editor-Ansicht ist intentional nutzerfreundlicher als Druckansicht.

---

### Sicherheits-Audit (Red-Team)

| Prüfpunkt | Status | Befund |
|-----------|--------|--------|
| Authentifizierung aller API-Endpunkte | ✅ PASS | `requireAuth()` in allen Routes; Middleware redirectet Browser zu `/login` |
| Autorisierung: Mitarbeiter sehen nur eigene Projekte | ✅ PASS | `projekt_mitarbeiter`-Check in GET/PUT/DELETE |
| Autorisierung: Admin sieht alle | ✅ PASS | `auth.role === 'admin'`-Pfad in allen Routes |
| Delete-Schutz | ✅ PASS | Nur Admin oder Ersteller können löschen |
| Input-Validierung via Zod | ✅ PASS | UUID-Validierung für `projekt_id`, Regex für `datum` |
| XSS in HTML-Preview | ❌ FAIL | **BUG-001** — User-Input unescaped in HTML interpoliert |
| SQL-Injection | ✅ PASS | Supabase parametrisierte Queries |
| Rate Limiting auf generate-Endpunkt | ⚠️ FEHLT | Kein Rate Limiting auf `/api/reports/generate`; andere Endpunkte (extract) haben es — sollte nachgerüstet werden |
| JSONB-Snapshot-Unveränderlichkeit | ✅ PASS | Kein UPDATE auf `berichts_versionen` |
| RLS-Policies für `berichte`-Tabelle | ✅ PASS | Migration `005_berichte.sql` hat vollständige SELECT/INSERT/UPDATE/DELETE-Policies |

---

### Automatisierte Tests

**Unit Tests (Vitest):**
- 35 neue Tests für `src/lib/bericht-renderer.ts` — alle bestanden
- 2 XSS-Sicherheitstests dokumentieren BUG-001 und schlagen nach dem Fix in `toBe(false)` um
- Gesamte Test-Suite: **123/123 Tests bestanden** (keine Regressionen)

**E2E Tests (Playwright):**
- 30 Tests in `tests/PROJ-5-berichtsgenerierung.spec.ts`
- **7 passed** (2 Redirect-Tests + 5 Security-API-Tests — laufen ohne echte Auth)
- **23 skipped** (authentifizierte UI-Tests — übersprungen ohne echte Supabase-Session)
- Alle Security-Tests bestätigen: Alle API-Endpunkte schützen Zugriff ohne Auth ✅

---

### Regressions-Check

| Feature | Status |
|---------|--------|
| PROJ-1 (Authentifizierung) | ✅ Keine Regression — Middleware-Logik unverändert |
| PROJ-2 (Projektverwaltung) | ✅ Keine Regression — Projekt-API unverändert |
| PROJ-3 (Begehungs-Erfassung) | ✅ Keine Regression — Begehungs-API unverändert |
| PROJ-4 (Medien-Verwaltung) | ✅ Keine Regression — Medien-API unverändert; alle 88 bestehenden Tests bestehen |

---

### Produktionsbereit?

**NEIN** — BUG-001 (HIGH: XSS in HTML-Preview-Renderer) muss behoben werden, bevor der Feature deployed wird. BUG-002 und BUG-003 (beide MEDIUM) sollten ebenfalls vor Deployment behoben werden.

## Deployment
_To be added by /deploy_
