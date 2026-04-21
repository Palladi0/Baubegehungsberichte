# PROJ-2: Projektverwaltung

## Status: Planned
**Created:** 2026-04-21
**Last Updated:** 2026-04-21

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Admins können Projekte anlegen/verwalten

## Beschreibung
Admins legen Bauprojekte im System an und pflegen Stammdaten (Projektname, -nummer, Auftraggeber, Adresse, Laufzeit). Mitarbeiter werden einem oder mehreren Projekten zugeordnet. Das Projektkürzel (z. B. `BV-23-Hamburg`) dient später als Hashtag zur automatischen Zuordnung von WhatsApp-Nachrichten.

## User Stories
- Als **Admin** möchte ich ein neues Projekt mit Name, Nummer und Kürzel anlegen, damit Mitarbeiter Nachrichten korrekt zuordnen können.
- Als **Admin** möchte ich Mitarbeiter einem Projekt zuordnen, damit die Berechtigungen und Zuordnungen klar definiert sind.
- Als **Admin** möchte ich Projekte archivieren (nicht löschen), damit vergangene Projekte noch einsehbar sind.
- Als **Mitarbeiter** möchte ich eine Liste meiner zugeordneten Projekte sehen, damit ich schnell das richtige Projekt für eine Begehung auswählen kann.
- Als **Admin** möchte ich Projektdetails bearbeiten können, damit Änderungen (z. B. neue Adresse) aktuell bleiben.

## Acceptance Criteria
- [ ] Projekt-Anlage-Formular mit Pflichtfeldern: Projektname, Projektnummer, Projektkürzel (eindeutig, z. B. `BV-23-Hamburg`)
- [ ] Optionale Felder: Auftraggeber, Bauherr, Projektadresse, geplantes Startdatum, geplantes Enddatum, Beschreibung
- [ ] Projektkürzel ist eindeutig im System — Doppelungen werden beim Speichern verhindert
- [ ] Mitarbeiterzuordnung: Admin kann einem Projekt beliebig viele Mitarbeiter zuordnen/entfernen
- [ ] Projektliste mit Suchfunktion (nach Name, Nummer, Kürzel) und Filter (aktiv/archiviert)
- [ ] Projektdetailseite zeigt alle Stammdaten + zugeordnete Mitarbeiter + Anzahl Begehungsberichte
- [ ] Projekt archivieren: Status wechselt zu „Archiviert"; Daten bleiben erhalten; keine neuen Begehungen mehr möglich
- [ ] Archivierte Projekte sind in der Standardansicht ausgeblendet, aber über Filter sichtbar
- [ ] Mitarbeiter sehen nur ihre zugeordneten Projekte; Admins sehen alle Projekte

## Edge Cases
- Was passiert, wenn ein Projekt mit bestehenden Berichten archiviert wird? → Archivierung möglich; bestehende Berichte bleiben lesbar, aber neue Begehungen können nicht gestartet werden.
- Was passiert, wenn ein Mitarbeiter aus einem Projekt entfernt wird, dem bereits Berichte zugeordnet sind? → Entfernung ist möglich; die historischen Berichte bleiben dem Projekt erhalten.
- Was passiert, wenn zwei Admins gleichzeitig dasselbe Projekt bearbeiten? → Letzter Speichervorgang gewinnt; kein Echtzeit-Locking erforderlich (MVP).
- Was passiert, wenn ein Projekt-Kürzel geändert wird? → Bestehende Berichte bleiben dem Projekt zugeordnet; neue WhatsApp-Nachrichten müssen das neue Kürzel verwenden.
- Was passiert, wenn ein Mitarbeiter versucht, ein nicht-zugeordnetes Projekt aufzurufen? → 403-Fehler oder Redirect zur Projektliste.

## Technical Requirements
- Projektkürzel: Alphanumerisch, Bindestriche erlaubt, max. 20 Zeichen, case-insensitive Vergleich
- Soft-Delete für Projekte (archivieren statt löschen, `archived_at`-Timestamp)
- API-Endpunkte: GET /projects, POST /projects, PUT /projects/:id, PATCH /projects/:id/archive
- Rollenbasierter Zugriff: Schreibzugriff nur für Admins, Lesezugriff für Mitarbeiter (nur eigene Projekte)

---

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
