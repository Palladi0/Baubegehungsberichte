# PROJ-9: Sprach-Transkription

## Status: Planned
**Created:** 2026-04-21
**Last Updated:** 2026-04-21

## Dependencies
- Requires: PROJ-8 (WhatsApp-Integration) — Sprachnachrichten kommen über den WhatsApp-Kanal

## Beschreibung
Sprachnachrichten, die über WhatsApp eingehen, werden automatisch in deutschen Text transkribiert. OpenAI Whisper wird für die Sprache-zu-Text-Konvertierung verwendet, da es zuverlässig Deutsch erkennt und mit Baufachsprache und Eigennamnen umgehen kann. Das Transkript wird anschließend an PROJ-10 (Projektzuordnung) und PROJ-3 (KI-Extraktion) weitergegeben.

## User Stories
- Als **System** möchte ich eingehende Sprachnachrichten automatisch transkribieren, damit Mitarbeiter keine manuellen Texteingaben für WhatsApp-Nachrichten vornehmen müssen.
- Als **Mitarbeiter** möchte ich das Transkript meiner Sprachnachricht in der App sehen und korrigieren können, damit Fehler in der Erkennung behoben werden.
- Als **System** möchte ich eine fehlgeschlagene Transkription erkennen und dem Mitarbeiter per WhatsApp mitteilen, damit kein Datenverlust entsteht.
- Als **Admin** möchte ich Transkriptions-Kosten im Admin-Bereich nachverfolgen (Anzahl Minuten/Monat), damit das Budget überwacht werden kann.

## Acceptance Criteria
- [ ] Eingehende Sprachnachrichten (ogg, mp4, m4a, wav) werden automatisch an Whisper API gesendet
- [ ] Sprache: Deutsch (`language: "de"` in Whisper API) — kein automatisches Sprachdetektieren
- [ ] Transkription wird in der `incoming_messages`-Tabelle gespeichert (Feld: `transcript`)
- [ ] Verarbeitung: asynchron im Hintergrund (nicht blockierend für den Webhook)
- [ ] Mitarbeiter erhält WhatsApp-Bestätigung nach erfolgreicher Transkription: „✓ Nachricht transkribiert: [erste 100 Zeichen des Transkripts]..."
- [ ] Transkript ist in der Web-App einsehbar und editierbar (in der Begehungs-Erfassung unter PROJ-3)
- [ ] Maximale Audiodatei-Länge: 10 Minuten (WhatsApp-Limit); Warnung bei > 5 Minuten
- [ ] Transkriptions-Log im Admin-Bereich: Datum, Dauer, Status (Erfolg/Fehler), Kosten (Whisper: $0.006/min)

## Edge Cases
- Was passiert, wenn Whisper das Audio nicht verarbeiten kann (korrupte Datei)? → Fehlermeldung per WhatsApp an Absender: „Ihre Sprachnachricht konnte nicht verarbeitet werden. Bitte senden Sie sie erneut." Admin-Alert.
- Was passiert, wenn die Sprachnachricht nicht auf Deutsch ist? → Transkription versucht trotzdem; Qualität kann schlecht sein; kein automatischer Fallback.
- Was passiert, wenn Whisper Fachbegriffe oder Eigennamen falsch erkennt (z. B. Projektnamen)? → Transkript kann in der Web-App manuell korrigiert werden; KI-Extraktion läuft erst nach möglicher Korrektur.
- Was passiert, wenn die Whisper API nicht verfügbar ist? → Nachricht wird in der Queue belassen und nach 5 Minuten erneut versucht (max. 3 Versuche); danach: manuelles Eingreifen erforderlich.
- Was passiert bei sehr schlechter Audioqualität (Baustellenlärm)? → Transkript enthält `[unverständlich]`-Markierungen; Mitarbeiter kann Fehlstellen manuell ergänzen.

## Technical Requirements
- OpenAI Whisper API (`whisper-1` Modell)
- Audio-Vorverarbeitung: Falls nötig Konvertierung zu mp3/wav (ffmpeg serverseitig)
- Queue-System: Asynchrone Verarbeitung (z. B. BullMQ oder einfache DB-Queue)
- Maximale Verarbeitungszeit: < 60 Sekunden für 5-Minuten-Audio
- API-Endpunkte: POST /transcriptions (intern, nicht öffentlich)
- Kosten-Logging: Audiodauer in Sekunden pro Transkription in DB speichern

---

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
