# PROJ-3: Begehungs-Erfassung

## Status: Planned
**Created:** 2026-04-21
**Last Updated:** 2026-04-21

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — Mitarbeiter muss eingeloggt sein
- Requires: PROJ-2 (Projektverwaltung) — Begehung wird einem Projekt zugeordnet

## Beschreibung
Mitarbeiter erfassen Baustellenbegehungen über ein strukturiertes Webformular. Neben manueller Eingabe kann der Mitarbeiter auch freitext-Notizen oder einen transkribierten Sprachtext eingeben — Claude (Anthropic API) extrahiert daraus automatisch strukturierte Felder wie Beteiligte, Wetterbedingungen, Leistungsstand und besondere Vorkommnisse. Der Mitarbeiter prüft die extrahierten Felder und speichert die Begehung ab.

## User Stories
- Als **Mitarbeiter** möchte ich eine neue Begehung für ein meiner Projekte anlegen, damit ich Baustellenfortschritte dokumentieren kann.
- Als **Mitarbeiter** möchte ich freitext-Notizen eingeben und die KI soll daraus automatisch strukturierte Felder befüllen, damit ich weniger manuell tippen muss.
- Als **Mitarbeiter** möchte ich alle extrahierten Felder vor dem Speichern prüfen und korrigieren, damit die Daten korrekt sind.
- Als **Mitarbeiter** möchte ich eine bereits erstellte Begehung nachbearbeiten können, damit Fehler korrigiert werden können.
- Als **Admin** möchte ich alle Begehungen aller Mitarbeiter einsehen können, damit ich eine Gesamtübersicht habe.

## Acceptance Criteria

### Pflichtfelder (Deckblatt des Berichts):
- [ ] Projekt (Auswahl aus zugeordneten Projekten)
- [ ] Datum der Begehung (Datumsauswahl, Default: heute)
- [ ] Uhrzeit der Begehung (Default: aktuelle Uhrzeit)
- [ ] Wetterbedingungen (Freitext oder Auswahl: Sonnig / Bewölkt / Regnerisch / Schnee / Nebel)
- [ ] Temperatur in °C (Zahlenfeld)
- [ ] Teilnehmer / Beteiligte (Liste von Namen und Rollen, dynamisch erweiterbar)

### Weitere Felder:
- [ ] Leistungsstand (Freitext, z. B. „Rohbau ca. 60% fertig")
- [ ] Besondere Vorkommnisse (Freitext, strukturierbar als Liste)
- [ ] Nächste Schritte / Maßnahmen (Freitext)
- [ ] Allgemeine Bemerkungen (Freitext)

### KI-Extraktion:
- [ ] Eingabefeld für Freitext-Notizen (Paste-fähig, min. 5 Zeilen)
- [ ] Button „KI-Extraktion starten" — Claude analysiert den Text und befüllt Formularfelder
- [ ] Extrahierte Felder werden visuell hervorgehoben (z. B. gelber Hintergrund) zur Prüfung
- [ ] Nutzer kann extrahierte Felder überschreiben
- [ ] Wenn KI kein Feld erkennen kann, bleibt es leer (kein Raten)
- [ ] Extraktion dauert max. 10 Sekunden; Fortschrittsanzeige sichtbar

### Allgemein:
- [ ] Formular speichert Entwurf automatisch alle 60 Sekunden (autosave)
- [ ] Begehung kann als „Entwurf" oder „Fertig" gespeichert werden
- [ ] Nur „Fertige" Begehungen können in einen Bericht aufgenommen werden

## Edge Cases
- Was passiert, wenn Claude nichts aus dem Text extrahieren kann? → Alle Felder bleiben leer; Toast-Nachricht: „Keine Felder erkannt. Bitte Felder manuell ausfüllen."
- Was passiert, wenn die Extraktion fehlschlägt (API-Timeout)? → Fehlermeldung; Freitext-Eingabe bleibt erhalten; manuelle Eingabe möglich.
- Was passiert, wenn eine Begehung mit dem gleichen Datum und Projekt bereits existiert? → Warnung (keine Blockierung): „Es existiert bereits eine Begehung für dieses Projekt an diesem Datum."
- Was passiert, wenn ein Mitarbeiter die Seite verlässt ohne zu speichern? → Browser-Verlassen-Dialog nur, wenn ungespeicherte Änderungen vorhanden.
- Was passiert bei der Bearbeitung einer bereits in einem Bericht enthaltenen Begehung? → Bearbeitung möglich, aber Warnung: „Diese Begehung ist bereits in einem Bericht enthalten. Änderungen aktualisieren den Bericht."

## Technical Requirements
- Claude-API-Prompt: strukturierte JSON-Antwort mit definierten Feldern (Datum, Teilnehmer, Wetter, Temperatur, Leistungsstand, Vorkommnisse, Maßnahmen)
- Extraktion erfolgt serverseitig (API-Key nie im Frontend)
- Formulardaten-Persistenz: autosave in localStorage als Backup; finale Daten nur in DB
- API-Endpunkte: GET /inspections, POST /inspections, PUT /inspections/:id, POST /inspections/extract

---

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
