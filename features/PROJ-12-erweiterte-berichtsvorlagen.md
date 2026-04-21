# PROJ-12: Erweiterte Berichtsvorlagen

## Status: Planned
**Created:** 2026-04-21
**Last Updated:** 2026-04-21

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
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
