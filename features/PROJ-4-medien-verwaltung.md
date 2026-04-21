# PROJ-4: Medien-Verwaltung

## Status: Planned
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
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
