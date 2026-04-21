# PROJ-5: Berichtsgenerierung

## Status: Planned
**Created:** 2026-04-21
**Last Updated:** 2026-04-21

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
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
