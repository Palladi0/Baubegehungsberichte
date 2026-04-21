# PROJ-7: Berichte-Dashboard

## Status: Planned
**Created:** 2026-04-21
**Last Updated:** 2026-04-21

## Dependencies
- Requires: PROJ-1 (Authentifizierung)
- Requires: PROJ-5 (Berichtsgenerierung) — Berichte müssen existieren
- Requires: PROJ-6 (PDF-Export) — PDFs müssen abrufbar sein

## Beschreibung
Zentrales Dashboard für die Verwaltung aller generierten Berichte. Mitarbeiter und Admins sehen eine gefilterte Liste aller Berichte (nach Projekt, Datum, Status). Von hier aus können Berichte geöffnet, bearbeitet, als PDF heruntergeladen oder gelöscht werden. Admins sehen alle Berichte des Büros; Mitarbeiter nur Berichte ihrer Projekte.

## User Stories
- Als **Mitarbeiter** möchte ich auf der Startseite nach dem Login eine Übersicht der letzten Berichte sehen, damit ich schnell den aktuellen Stand finde.
- Als **Mitarbeiter** möchte ich Berichte nach Projekt und Datum filtern, damit ich schnell einen bestimmten Bericht finde.
- Als **Mitarbeiter** möchte ich einen Bericht direkt aus der Liste herunterladen, ohne ihn erst öffnen zu müssen.
- Als **Admin** möchte ich Berichte löschen können, damit veraltete oder fehlerhafte Berichte entfernt werden.
- Als **Mitarbeiter** möchte ich den Status eines Berichts sehen (Entwurf / Fertig), damit ich weiß, welche Berichte noch bearbeitet werden müssen.

## Acceptance Criteria
- [ ] Dashboard ist die Startseite nach dem Login
- [ ] Berichtsliste zeigt: Projektname, Datum, Ersteller, Status (Entwurf/Fertig), Anzahl Fotos, Erstellungsdatum
- [ ] Filter: nach Projekt (Dropdown), nach Datumsbereich (Von–Bis), nach Status (Alle/Entwurf/Fertig)
- [ ] Suchfeld: Volltextsuche in Projektname und Berichtsdatum
- [ ] Sortierung: nach Datum (Standard: neueste zuerst), nach Projekt, nach Ersteller
- [ ] Schnellaktionen pro Bericht: „Öffnen", „PDF herunterladen", „Duplizieren", „Löschen"
- [ ] „Neuer Bericht"-Button oben rechts (führt zur Berichtsgenerierung)
- [ ] Berichts-Löschung: Bestätigungsdialog erforderlich; nur Admins oder Eigentümer des Berichts dürfen löschen
- [ ] Statusanzeige: Entwurf (gelb), Fertig (grün) — visuell unterscheidbar
- [ ] Leere Ansicht: Hilfetext wenn keine Berichte vorhanden sind: „Noch keine Berichte. Erstelle deinen ersten Bericht."
- [ ] Paginierung oder Infinite Scroll (max. 25 Einträge pro Seite)

## Edge Cases
- Was passiert, wenn ein Mitarbeiter versucht, den Bericht eines anderen Mitarbeiters zu löschen? → 403-Fehler; nur Admin oder Eigentümer kann löschen.
- Was passiert, wenn ein Bericht gelöscht wird, dessen PDF noch existiert? → PDF wird ebenfalls gelöscht (oder in Papierkorb verschoben, je nach Konfig).
- Was passiert, wenn sehr viele Berichte vorhanden sind (> 1000)? → Paginierung stellt sicher, dass die Seite performant bleibt; Datenbankindizierung nach Datum und Projekt.
- Was passiert, wenn ein Bericht als „Fertig" markiert ist aber erneut bearbeitet wird? → Status wechselt automatisch zurück zu „Entwurf"; Admin wird ggf. informiert.

## Technical Requirements
- API-Endpunkte: GET /reports (mit Filter-Params), DELETE /reports/:id, PATCH /reports/:id/status
- Clientseitiges Caching für die Berichtsliste (kurze TTL: 30 Sekunden)
- Bulk-Aktionen (P2): Mehrere Berichte gleichzeitig löschen oder exportieren
- Responsive: Dashboard muss auf Tablets funktionieren (iPads auf der Baustelle)

---

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
