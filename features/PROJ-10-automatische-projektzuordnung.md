# PROJ-10: Automatische Projektzuordnung

## Status: Planned
**Created:** 2026-04-21
**Last Updated:** 2026-04-21

## Dependencies
- Requires: PROJ-2 (Projektverwaltung) — Projektkürzel müssen im System hinterlegt sein
- Requires: PROJ-8 (WhatsApp-Integration) — Nachrichten kommen über WhatsApp
- Requires: PROJ-9 (Sprach-Transkription) — Projektkürzel können aus Transkript extrahiert werden

## Beschreibung
Eingehende WhatsApp-Nachrichten werden automatisch einem Projekt zugeordnet. Primäre Methode: Erkennung eines Hashtags/Kürzels im Text (z. B. `#BV-23-Hamburg`). Sekundäre Methode: Absender-Mapping (welche Projekte sind dem Mitarbeiter zugeordnet?). Kann das System nicht eindeutig zuordnen, wird die Nachricht als „nicht zugeordnet" markiert und der Mitarbeiter wird per WhatsApp gebeten, das Kürzel anzugeben.

## User Stories
- Als **Mitarbeiter** möchte ich ein Projektkürzel (`#BV-23-Hamburg`) in meine Nachricht schreiben, damit das System meine Nachricht automatisch dem richtigen Projekt zuordnet.
- Als **System** möchte ich bei eindeutiger Absender-Zuordnung (Mitarbeiter ist nur einem Projekt zugeordnet) die Nachricht ohne Hashtag automatisch zuordnen, damit Mitarbeiter das Kürzel nicht immer schreiben müssen.
- Als **System** möchte ich bei unklarer Zuordnung den Mitarbeiter per WhatsApp fragen, welchem Projekt die Nachricht gehört, damit kein Datenverlust durch falsche Zuordnung entsteht.
- Als **Mitarbeiter** möchte ich eine Nachricht in der Web-App manuell einem Projekt zuordnen können, damit fehlerhafte automatische Zuordnungen korrigiert werden können.

## Acceptance Criteria

### Zuordnungs-Logik (Prioritätsreihenfolge):
1. **Hashtag im Text** (`#BV-23-Hamburg` oder `#bv-23-hamburg` — case-insensitive): Exakter Match gegen Projektkürzel in der DB → Zuordnung zu diesem Projekt
2. **Hashtag im Transkript** (bei Sprachnachrichten): Gleiche Logik wie oben, auf dem Transkript-Text
3. **Eindeutige Absender-Zuordnung**: Mitarbeiter ist genau einem aktiven Projekt zugeordnet → Automatische Zuordnung ohne Hashtag
4. **Manuelles Klärungsverfahren**: Keine eindeutige Zuordnung → WhatsApp-Nachricht an Absender

- [ ] Hashtag-Erkennung ist case-insensitive und erkennt `#` als Präfix
- [ ] Mehrere Hashtags in einer Nachricht sind erlaubt; alle erkannten Projekte werden angezeigt; Mitarbeiter wählt das korrekte
- [ ] Unbekannte Hashtags (nicht im System) führen zur manuellen Klärung
- [ ] Klärungsverfahren: WhatsApp-Antwort: „Für welches Projekt ist diese Nachricht? Bitte antworte mit dem Kürzel (z. B. BV-23-Hamburg)."
- [ ] Antwort des Mitarbeiters auf die Klärungsfrage ordnet die ursprüngliche Nachricht automatisch zu
- [ ] Nicht-zugeordnete Nachrichten erscheinen im Admin-Dashboard als Aufgabe „Manuell zuordnen"
- [ ] Manuelle Zuordnung in der Web-App: Admin/Mitarbeiter wählt Projekt aus Dropdown
- [ ] Zuordnungs-Protokoll: Jede Zuordnung wird geloggt (Methode: Hashtag/Absender/Manuell, Timestamp)

## Edge Cases
- Was passiert, wenn das Hashtag einem archivierten Projekt entspricht? → Fehlermeldung an Absender: „Projekt [Kürzel] ist archiviert. Bitte wähle ein aktives Projekt."
- Was passiert, wenn der Mitarbeiter auf die Klärungsfrage mit einem unbekannten Kürzel antwortet? → System fragt erneut nach; nach 3 Fehlversuchen: Nachricht wird als „Zuordnung fehlgeschlagen" markiert.
- Was passiert bei zeitlicher Reihenfolge (mehrere Nachrichten kurz hintereinander)? → Jede Nachricht wird einzeln betrachtet; keine zeitliche Kettenlogik im MVP.
- Was passiert, wenn Mitarbeiter mehreren Projekten zugeordnet sind und kein Hashtag senden? → Fallback auf Klärungsverfahren; kein automatisches Raten.

## Technical Requirements
- Hashtag-Regex: `/#([A-Za-z0-9\-]+)/g` — extrahiert alle Hashtags aus Text
- Datenbankabfrage: Case-insensitive Vergleich von Hashtag gegen `projects.slug`-Feld
- State Machine für Klärungsverfahren: Status `awaiting_project_clarification` in `incoming_messages`-Tabelle
- Klärungsantworten werden durch Message-Kontext erkannt (In-Reply-To oder zeitliche Nähe < 30 Min)

---

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
