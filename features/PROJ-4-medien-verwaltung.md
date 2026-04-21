# PROJ-4: Medien-Verwaltung

## Status: Architected
**Created:** 2026-04-21
**Last Updated:** 2026-04-21

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

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
