# PROJ-4: Medien-Verwaltung

## Status: In Review
**Created:** 2026-04-21
**Last Updated:** 2026-04-23

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — Nutzer muss eingeloggt sein
- Requires: PROJ-2 (Projektverwaltung) — Fotos werden Projekten zugeordnet
- Requires: PROJ-3 (Begehungs-Erfassung) — Fotos werden optional einer Begehung zugeordnet

## Beschreibung
Mitarbeiter laden Fotos von Baustellenbegehungen hoch. Fotos werden auf dem Self-Hosted-Server gespeichert (kein Cloud-Provider). Jedes Foto wird einem Projekt und optional einer Begehung zugeordnet. Der Mitarbeiter kann Fotos mit einem Freitext-Kommentar versehen. Claude analysiert Fotos optional und kann automatisch Bildunterschriften oder Kategorien vorschlagen (z. B. „Rohbau", „Mängel", „Dokumentation").

## User Stories
- Als **Mitarbeiter** möchte ich Fotos direkt beim Erfassen einer Begehung hochladen, damit Bilder sofort dem richtigen Kontext zugeordnet sind.
- Als **Mitarbeiter** möchte ich Fotos nachträglich einer bestehenden Begehung hinzufügen, damit ich auch später vom Büro aus Fotos ergänzen kann.
- Als **Mitarbeiter** möchte ich jedem Foto eine Bildunterschrift/Kommentar hinzufügen, damit der Inhalt des Fotos im Bericht klar erkennbar ist.
- Als **Mitarbeiter** möchte ich die KI um eine automatische Bildunterschrift bitten, damit ich weniger tippen muss.
- Als **Admin** möchte ich Fotos aus dem System löschen können, damit fehlerhafte oder unerwünschte Bilder entfernt werden können.

## Acceptance Criteria
- [ ] Drag-and-Drop-Upload sowie Datei-Browser für Foto-Upload (JPEG, PNG, HEIC, WebP — max. 25 MB pro Datei)
- [ ] Gleichzeitiger Upload von bis zu 20 Fotos pro Vorgang
- [ ] Hochgeladene Fotos werden serverseitig komprimiert (max. 2 MB für Anzeigeversion, Original wird behalten)
- [ ] Fotos werden einem Projekt zugeordnet (Pflicht) und optional einer Begehung (optional)
- [ ] Jedes Foto kann mit einer Bildunterschrift (max. 500 Zeichen) versehen werden
- [ ] Button „KI-Bildunterschrift generieren" — Claude analysiert das Bild und schlägt eine deutsche Bildunterschrift vor
- [ ] Galerie-Ansicht pro Projekt: Rasteransicht aller Fotos mit Datum, Uploader, Bildunterschrift
- [ ] Fotos sind sortierbar: nach Uploaddatum, Begehungsdatum
- [ ] Foto löschen: Soft-Delete (Foto wird aus allen Berichten entfernt); nur eigene Fotos oder Admin
- [ ] Fotos werden nicht öffentlich zugänglich gespeichert (authentifizierter Zugriff)

## Edge Cases
- Was passiert, wenn ein Foto zu groß ist (> 25 MB)? → Fehlermeldung beim Upload: „Diese Datei überschreitet die maximale Dateigröße von 25 MB."
- Was passiert, wenn ein nicht-unterstütztes Format hochgeladen wird? → Fehlermeldung: „Nur JPEG, PNG, HEIC und WebP werden unterstützt."
- Was passiert, wenn der Speicherplatz auf dem Server voll ist? → Upload fehlschlägt mit Fehlermeldung; Admin erhält System-Warnung (E-Mail oder Dashboard-Alert).
- Was passiert, wenn ein Foto gelöscht wird, das in einem bereits gedruckten PDF ist? → Das PDF bleibt unverändert; das Foto wird nur aus der Datenbank und zukünftigen Berichten entfernt.
- Was passiert, wenn die KI-Bildanalyse kein Baustellen-relevantes Motiv erkennt? → Neutrale Bildunterschrift: „Bitte Beschreibung manuell hinzufügen."
- Was passiert bei HEIC-Dateien (iPhone-Format)? → Serverseitige Konvertierung zu JPEG vor Speicherung.

## Technical Requirements
- Speicherort: Lokales Dateisystem des Servers (z. B. `/var/uploads/photos/[project-id]/`)
- Dateinamen: UUIDs zur Vermeidung von Konflikten und Pfad-Traversal-Angriffen
- Thumbnail-Generierung: Automatisch bei Upload (400x300 für Galerie, 1200x900 für Bericht)
- Maximale Speicherkapazität pro Projekt: konfigurierbar (Default: 5 GB)
- Claude Vision API für Bildanalyse (serverseitig)
- API-Endpunkte: POST /media/upload, GET /media/:projectId, DELETE /media/:id, POST /media/:id/caption

---

## Tech Design (Solution Architect)

### Gewählter Ansatz: Lokales Dateisystem + Supabase DB + Authenticated File Serving

Fotos werden auf dem eigenen Server im Dateisystem abgelegt — kein Cloud-Storage, keine externen Dienste. Supabase PostgreSQL speichert ausschließlich Metadaten (Dateinamen, Captions, Zuordnungen). Next.js API-Routes liefern die Dateien nur nach erfolgter Auth-Prüfung aus. Die Claude Vision API (bereits installiert via PROJ-3) generiert KI-Bildunterschriften serverseitig.

---

### Komponentenstruktur

```
/projekte/[id]/medien  (Galerie-Seite pro Projekt)
+-- MedienHeader
|   +-- Projekttitel + Foto-Anzahl
|   +-- SortierAuswahl           (shadcn/ui Select: nach Uploaddatum / Begehungsdatum)
|   +-- UploadButton             (öffnet Upload-Dropzone)
|
+-- UploadDropzone               (Drag & Drop + Datei-Browser)
|   +-- DropZoneFläche           (visuelles Ziel-Feld für Drag & Drop)
|   +-- UploadFortschritt        (shadcn/ui Progress, pro Datei + Gesamt)
|   +-- DateiValidierungsFehler  (shadcn/ui Alert: Größe, Format)
|
+-- FotoGalerie                  (Rasteransicht, responsive)
|   +-- FotoKachel  (pro Foto)
|       +-- ThumbnailBild        (lädt via /api/media/file/[id]?v=thumb)
|       +-- BildunterschriftText (max. 2 Zeilen, Truncation)
|       +-- Meta-Zeile           (Datum | Uploader | Begehungs-Kürzel)
|       +-- KachelAktionen       (erscheint bei Hover)
|           +-- BearbeitenButton (öffnet FotoDetailDialog)
|           +-- LöschenButton    (öffnet LöschConfirmDialog — nur Besitzer od. Admin)
|
+-- FotoDetailDialog             (shadcn/ui Dialog)
|   +-- GroßbildAnzeige          (lädt via /api/media/file/[id]?v=display)
|   +-- BildunterschriftFeld     (shadcn/ui Textarea, max. 500 Zeichen)
|   +-- KI-CaptionButton         ("KI-Bildunterschrift generieren")
|   +-- KI-VorschlagBanner       (shadcn/ui Alert mit Vorschlag-Text + "Übernehmen"-Button)
|   +-- FortschrittsAnzeige      (shadcn/ui Progress — während KI-Analyse)
|   +-- BegehungsZuordnung       (shadcn/ui Select — optional einer Begehung zuordnen)
|   +-- SpeichernButton
|
+-- LöschConfirmDialog           (shadcn/ui AlertDialog)
    +-- Warnung: "Foto wird aus allen zukünftigen Berichten entfernt."
    +-- LöschenBestätigenButton
```

---

### Datenmodell

**Tabelle `fotos`** — eine Zeile pro hochgeladenes Foto:

| Feld | Typ | Beschreibung |
|---|---|---|
| ID | UUID | Eindeutige Kennung (= Verzeichnisname auf dem Dateisystem) |
| Projekt-ID | UUID | Pflicht → Fremdschlüssel `projekte` |
| Begehungs-ID | UUID | Optional → Fremdschlüssel `begehungen` |
| Uploader-ID | UUID | Fremdschlüssel `nutzer_profile` |
| Original-Dateiname | Text | Anzeigename (z. B. „IMG_4521.HEIC") |
| Datei-Endung | Text | Endung nach Konvertierung (HEIC wird immer zu `.jpg`) |
| Dateigröße (Original) | Integer | In Bytes |
| Bildunterschrift | Text | Manuell oder KI-übernommen, max. 500 Zeichen |
| Gelöscht am | Zeitstempel | `null` = aktiv; Wert = Soft-Delete-Zeitpunkt |
| Erstellt am | Zeitstempel | Automatisch beim Upload |
| Zuletzt geändert | Zeitstempel | Automatisch bei jeder Änderung |

**Dateisystem-Struktur** auf dem Server:
```
/var/uploads/photos/
  [foto-uuid]/
    original.[ext]      ← Originalformat (HEIC wird bereits zu JPEG konvertiert)
    display.jpg         ← Anzeige-Version: max. 1200×900, max. 2 MB
    thumb.jpg           ← Vorschau: exakt 400×300, < 100 KB
```

---

### Technische Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Datei-Ablageort | Lokales Dateisystem `/var/uploads/photos/` | DSGVO-Anforderung: keine Cloud; Self-hosted; Docker-Volume für Persistenz |
| Datei-Auslieferung | Next.js API Route mit Auth-Check vor File-Stream | Dateien sind nie direkt per URL erreichbar; jeder Zugriff wird geprüft |
| Bildverarbeitung | `sharp` (npm) | Industriestandard für Node.js; komprimiert JPEG/PNG/WebP; erstellt Thumbnails; läuft im Docker-Container |
| HEIC-Konvertierung | `heic-convert` (npm) | Reine JavaScript-Implementierung; kein systemseitiges libvips nötig; iPhone-Fotos werden zu JPEG konvertiert |
| Metadaten-Persistenz | Supabase PostgreSQL | Konsistent mit PROJ-1 und PROJ-3; RLS schützt Zeilen nach Projekt-Zugehörigkeit |
| Dateinamen | UUIDs | Verhindert Pfad-Traversal-Angriffe und Namenskonflikte bei Batch-Upload |
| Soft-Delete | Feld `gelöscht_am` in DB, Datei bleibt auf Disk | Bereits generierte PDFs (PROJ-6) bleiben funktionsfähig; Admin kann bei Bedarf endgültig bereinigen |
| KI-Caption | Anthropic Claude Vision API (`claude-sonnet-4-6`) | Bereits im Stack (PROJ-3); serverseitig; kein API-Key im Browser; analysiert `display`-Version (kleiner, spart Kosten) |
| Rollenzugriff | RLS: Mitarbeiter sehen nur eigene Projekte; Löschen nur eigene Fotos oder Admin | Konsistent mit PROJ-3-Muster |
| Batch-Upload | Multipart-Upload mit bis zu 20 Dateien gleichzeitig | Parallel-Verarbeitung in der API Route; Fortschritt per Polling |

---

### API-Routen (Next.js)

| Route | Zweck | Berechtigung |
|---|---|---|
| `POST /api/media/upload` | Multipart-Upload bis 20 Dateien (HEIC-Konvertierung + Komprimierung + Thumbnails) | Eingeloggt |
| `GET /api/media` | Fotoliste für ein Projekt (`?projektId=`, optional `?begehungsId=`) | Eingeloggt |
| `GET /api/media/file/[id]` | Datei-Stream nach Auth-Check (`?v=thumb\|display\|original`) | Eingeloggt |
| `PATCH /api/media/[id]` | Bildunterschrift oder Begehungs-Zuordnung aktualisieren | Besitzer oder Admin |
| `DELETE /api/media/[id]` | Soft-Delete (Feld `gelöscht_am` setzen) | Besitzer oder Admin |
| `POST /api/media/[id]/caption` | Claude Vision → KI-Bildunterschrift-Vorschlag (nicht auto-gespeichert) | Eingeloggt |

---

### Infrastruktur-Übersicht

```
Browser (Next.js Client)
+-- Drag & Drop Upload
|   → POST /api/media/upload  (multipart/form-data, bis 20 Dateien)
|       |
|       v  Next.js API Route (Server)
|       +-- Auth-Prüfung via Supabase
|       +-- Datei-Validierung: Format (JPEG/PNG/HEIC/WebP) + Größe (max. 25 MB)
|       +-- HEIC → JPEG: heic-convert
|       +-- sharp: Original speichern + display.jpg + thumb.jpg erzeugen
|       +-- Dateisystem: /var/uploads/photos/[uuid]/
|       +-- Supabase DB: Zeile in Tabelle `fotos` anlegen
|
+-- Galerie / Thumbnails
|   → GET /api/media?projektId=…
|   → GET /api/media/file/[id]?v=thumb   (Auth-Check → File-Stream)
|
+-- Großbild-Anzeige
|   → GET /api/media/file/[id]?v=display  (Auth-Check → File-Stream)
|
+-- KI-Bildunterschrift
    → POST /api/media/[id]/caption
        |
        v  Next.js API Route (Server)
        +-- Auth-Prüfung
        +-- Liest display.jpg vom Dateisystem (base64)
        +-- Anthropic Claude Vision API  ← einzige Stelle mit API-Key
        +-- Gibt Vorschlag zurück (nicht auto-gespeichert)
        +-- Nutzer klickt "Übernehmen" → PATCH /api/media/[id]

VPS (Docker)
+-- /var/uploads/photos/  (Docker Volume → bleibt bei Container-Updates erhalten)
+-- Supabase Stack (PostgreSQL, Auth, etc. — aus PROJ-1)
+-- Next.js App Container
```

---

### Neue Abhängigkeiten

| Paket | Zweck |
|---|---|
| `sharp` | Bildkomprimierung, Thumbnail-Generierung, Formatkonvertierung (JPEG/PNG/WebP) |
| `heic-convert` | HEIC → JPEG Konvertierung (iPhone-Fotos) serverseitig |

`@anthropic-ai/sdk` ist bereits aus PROJ-3 vorhanden. Alle shadcn/ui-Komponenten (Dialog, Progress, Alert, Select, Textarea) sind bereits installiert.

## Implementation Notes (2026-04-23)

**Was gebaut:**
- DB-Migration `004_fotos.sql`: Tabelle `fotos` mit Soft-Delete, RLS-Policies, Trigger für `aktualisiert_am`
- API-Routes: `POST /api/media/upload`, `GET /api/media`, `GET /api/media/file/[id]`, `PATCH /api/media/[id]`, `DELETE /api/media/[id]` (Soft-Delete), `POST /api/media/[id]/caption`
- Hilfsdienst `GET /api/benutzer/me` (neu) für Client-seitige Nutzerrolle
- `GET /api/begehungen` um `?projektId=`-Filter erweitert
- Frontend-Komponenten: `UploadDropzone`, `FotoKachel`, `FotoDetailDialog`, `LoeschConfirmDialog`
- Galerie-Seite: `/projekte/[id]/medien/page.tsx`
- Typ-Deklaration für `heic-convert` in `src/types/heic-convert.d.ts`

**Abweichungen vom Spec:**
- `UPLOAD_DIR` ist per Env-Var konfigurierbar (`UPLOAD_DIR`, default: `./uploads/photos` im Dev, `/var/uploads/photos` in Prod)
- Datei-Löschen beim Soft-Delete: Dateisystem-Bereinigung läuft asynchron (non-blocking), nicht synchron
- `/api/benutzer/me` wurde neu angelegt (war noch nicht vorhanden)

## QA Test Results

**QA-Datum:** 2026-04-25
**Tester:** /qa (Claude)
**Entscheidung: ❌ NICHT PRODUKTIONSREIF** — 1 High-Bug + 4 Medium-Bugs müssen behoben werden.

---

### Acceptance Criteria

| # | Kriterium | Status | Notiz |
|---|-----------|--------|-------|
| 1 | Drag-and-Drop-Upload + Datei-Browser (JPEG/PNG/HEIC/WebP, max. 25 MB) | ❌ **FAIL** | Drag-and-Drop speichert keine File-Objekte → Upload tut nichts (BUG-001) |
| 2 | Gleichzeitiger Upload bis zu 20 Fotos | ✅ PASS | Serverseitig + clientseitig korrekt limitiert |
| 3 | Serverseitige Komprimierung (max. 2 MB Anzeigeversion, Original behalten) | ✅ PASS | sharp erstellt display.jpg + thumb.jpg |
| 4 | Projektzuordnung (Pflicht), Begehungszuordnung (optional) | ✅ PASS | Upload + PATCH funktionieren korrekt |
| 5 | Bildunterschrift (max. 500 Zeichen) | ✅ PASS | DB-Constraint + Zod-Validierung + Client-Limit |
| 6 | KI-Bildunterschrift generieren (Claude Vision, nicht auto-gespeichert) | ✅ PASS | Endpunkt funktioniert, Vorschlag-Banner korrekt |
| 7 | Galerie-Ansicht (Rasteransicht, Datum, Uploader, Bildunterschrift) | ✅ PASS | Grid, Meta-Zeilen, Leer-Zustand korrekt |
| 8 | Sortierbar nach Upload-Datum und Begehungsdatum | ⚠️ **PARTIAL** | UI korrekt, aber `sort=begehung` sortiert nach `begehung_id` (UUID), nicht nach Datum (BUG-002) |
| 9 | Soft-Delete (nur Eigentümer oder Admin) | ✅ PASS | Permission-Check korrekt; aber Dateisystem-Bereinigung läuft sofort (BUG-005) |
| 10 | Kein öffentlicher Dateizugriff (Auth-Check vor File-Stream) | ✅ PASS | `GET /api/media/file/[id]` prüft Auth + Projektmitgliedschaft |

---

### Bugs

#### BUG-001 — HIGH: Drag-and-Drop Upload funktioniert nicht
- **Beschreibung:** `UploadDropzone.validiereUndSetze()` speichert nur `name/status` im State, nicht die eigentlichen `File`-Objekte. `starteUpload()` liest danach aus `inputRef.current?.files` — das ist `null` nach Drag-and-Drop → `gueltige = []` → frühzeitiger `return`, Upload passiert nicht.
- **Schritte:** Dateien auf Dropzone ziehen → Datei erscheint in der Liste mit Status „wartend" → „Hochladen" klicken → nichts passiert.
- **Betroffene Datei:** [UploadDropzone.tsx:32-92](src/components/medien/UploadDropzone.tsx#L32-L92)
- **Fix-Vorschlag:** `File`-Objekte in separatem `useRef<File[]>` oder `useState<File[]>` beim Drag-Event speichern; `starteUpload()` auf diesen State statt auf `inputRef.current.files` zugreifen.

#### BUG-002 — MEDIUM: Sortierung nach Begehungsdatum sortiert nach begehung_id (UUID)
- **Beschreibung:** `GET /api/media?sort=begehung` sortiert mit `.order('begehung_id', { ascending: false })`. UUIDs sind zufällig, keine zeitliche Ordnung.
- **Schritte:** Fotos mit verschiedenen Begehungen hochladen → nach Begehungsdatum sortieren → Reihenfolge ist zufällig.
- **Betroffene Datei:** [route.ts:61-63](src/app/api/media/route.ts#L61-L63)
- **Fix-Vorschlag:** Join auf `begehungen` und Sortierung nach `begehungen.datum DESC, fotos.erstellt_am DESC`.

#### BUG-003 — MEDIUM: KI-Caption-Endpunkt ohne Rate-Limiting
- **Beschreibung:** `POST /api/media/[id]/caption` hat kein Rate-Limiting. Wiederholte Aufrufe treiben Claude-API-Kosten unbegrenzt in die Höhe (Budget-Ziel: < 50 €/Monat).
- **Betroffene Datei:** [caption/route.ts](src/app/api/media/[id]/caption/route.ts)
- **Fix-Vorschlag:** Rate-Limiting analog zu `POST /api/begehungen/extract` (vgl. PROJ-3 BUG-005-Fix).

#### BUG-004 — MEDIUM: begehung_id wird nicht gegen Projektzugehörigkeit validiert
- **Beschreibung:** Bei Upload und PATCH wird `begehung_id` ohne Prüfung gespeichert, ob die Begehung zum selben Projekt gehört. Ein Nutzer kann Fotos aus Projekt A mit Begehungen aus Projekt B verknüpfen → Dateninkonsistenz.
- **Betroffene Dateien:** [upload/route.ts:64](src/app/api/media/upload/route.ts#L64), [id/route.ts:14](src/app/api/media/[id]/route.ts#L14)
- **Fix-Vorschlag:** Nach Akzeptanz der `begehung_id` prüfen: `SELECT id FROM begehungen WHERE id = $begehung_id AND projekt_id = $projekt_id`.

#### BUG-005 — MEDIUM: Soft-Delete löscht Dateien sofort vom Dateisystem
- **Beschreibung:** `DELETE /api/media/[id]` setzt `geloescht_am` (Soft-Delete) und löscht dann sofort asynchron die Dateien vom Disk. Spec sagt: „Admin kann bei Bedarf endgültig bereinigen." Zukünftige PDFs (PROJ-6), die per API-URL auf Fotos verweisen, würden nach dem Löschen 404 bekommen.
- **Betroffene Datei:** [id/route.ts:107-108](src/app/api/media/[id]/route.ts#L107-L108)
- **Fix-Vorschlag:** Dateisystem-Bereinigung aus dem Soft-Delete-Flow entfernen; separater Admin-Endpunkt oder Cleanup-Job für physisches Löschen.

#### BUG-006 — LOW: GET /api/media ohne .limit()
- **Beschreibung:** Die Galerie-Abfrage hat keine Paginierung — bei großen Projekten (> 1.000 Fotos) werden alle Datensätze auf einmal geladen.
- **Betroffene Datei:** [route.ts:38-65](src/app/api/media/route.ts#L38-L65)
- **Fix-Vorschlag:** `.limit(100)` ergänzen oder Cursor-basierte Paginierung implementieren.

---

### Security Audit

| Bereich | Befund | Status |
|---------|--------|--------|
| Authentifizierung | Alle 6 API-Endpunkte prüfen Auth via `requireAuth()` | ✅ OK |
| Datei-Auslieferung | `/api/media/file/[id]` prüft Auth + Projektmitgliedschaft vor File-Stream | ✅ OK |
| Path-Traversal | UUID-Validierung (`/^[0-9a-f-]{36}$/i`) verhindert Directory-Traversal | ✅ OK |
| UUID-Dateinamen | Keine vorhersehbaren Dateinamen, kein Namenskonflikt möglich | ✅ OK |
| XSS via Bildunterschrift | React escapet automatisch, kein `dangerouslySetInnerHTML` | ✅ OK |
| Dateityp-Spoofing | `sharp`-Verarbeitung schlägt bei Nicht-Bild fehl → Datei wird abgelehnt | ✅ OK |
| MIME-Type Validierung | Serverseitig via `file.type` + `sharp` Verarbeitung | ✅ OK |
| Rate-Limiting KI | `POST /api/media/[id]/caption` ohne Rate-Limit | ❌ BUG-003 |
| Begehungs-Zuordnung | Keine Projekt-Zugehörigkeitsprüfung für `begehung_id` | ❌ BUG-004 |
| RLS Policies | Tabelle `fotos` mit RLS, korrekte Policies für SELECT/INSERT/UPDATE/DELETE | ✅ OK |
| Soft-Delete Konsistenz | Dateisystem-Löschung widerspricht Soft-Delete-Konzept | ❌ BUG-005 |

---

### Test-Ergebnisse

**Unit-Tests (Vitest):**
- `src/app/api/media/upload/route.test.ts` — 10 Tests, alle ✅
- `src/app/api/media/route.test.ts` — 7 Tests, alle ✅
- `src/app/api/media/[id]/route.test.ts` — 16 Tests, alle ✅
- **Gesamt: 88 Tests bestanden (inkl. Regression — alle bestehenden 54 Tests weiterhin ✅)**

**E2E-Tests (Playwright/Chromium):**
- `tests/PROJ-4-medien-verwaltung.spec.ts` — 15 bestanden, 5 übersprungen (skipped = Auth-Session fehlt in CI/Dev-Umgebung, gleiche Situation wie PROJ-3)
- Security-Tests: 7 bestanden ✅ (kein unauthentifizierter Datenzugriff möglich)

---

### Bug-Priorität für Fix

| Priorität | Bug | Warum |
|-----------|-----|-------|
| 1️⃣ Sofort | BUG-001 | Core-Feature komplett defekt (Drag-and-Drop) |
| 2️⃣ Hoch | BUG-003 | Kostensicherheit (API-Budget) |
| 3️⃣ Hoch | BUG-004 | Datenintegrität (Cross-Projekt-Verknüpfung) |
| 4️⃣ Mittel | BUG-002 | Falsche Sortierung (irreführendes UX) |
| 5️⃣ Mittel | BUG-005 | Soft-Delete-Semantik gebrochen |
| 6️⃣ Niedrig | BUG-006 | Performance bei großen Projekten |

## Deployment
_To be added by /deploy_
