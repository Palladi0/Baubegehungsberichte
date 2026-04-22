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

### Kontext & Ausgangslage

PROJ-8 hat folgende Pipeline aufgebaut:

```
Twilio Webhook
  → incoming_messages (DB)
  → media_jobs (Queue)
  → Media Worker (lädt Datei herunter auf /var/uploads/...)
  → incoming_messages.local_file_path gesetzt
```

PROJ-9 verlängert diese Pipeline um einen zweiten asynchronen Schritt — die Transkription.

---

### Datenfluss (End-to-End)

```
1. Twilio Webhook (bereits fertig)
   └─→ incoming_messages (type=audio, status=received)
   └─→ media_jobs (pending)

2. Media Worker (bereits fertig, wird erweitert)
   └─→ Datei heruntergeladen → status=stored, local_file_path gesetzt
   └─→ NEU: transcription_jobs (pending) wird angelegt

3. Transcription Worker (NEU)
   └─→ Schickt Audiodatei an OpenAI Whisper API (language: "de")
   └─→ Speichert Transkript in incoming_messages.transcript
   └─→ Protokolliert Dauer + Kosten in transcription_jobs
   └─→ Sendet WhatsApp-Bestätigung an Absender via Twilio
   └─→ Bei Fehler: max. 3 Versuche, dann Admin-Alert

4. Web-App (PROJ-3 Erweiterung)
   └─→ Transkript anzeigen + editierbar machen

5. Admin-Panel (Erweiterung)
   └─→ Transkriptions-Log: Datum, Dauer, Status, Kosten
```

---

### Datenbankänderungen

**Erweiterung der bestehenden Tabelle `incoming_messages`** — 3 neue Felder:

```
incoming_messages (bestehend, wird erweitert):
+ transcript              Text des transkribierten Inhalts
+ transcript_status       Zustand: pending / processing / done / failed
+ audio_duration_seconds  Audiodauer in Sekunden (für Kosten-Tracking)
```

**Neue Tabelle `transcription_jobs`** — gleiche Struktur wie `media_jobs`:

```
transcription_jobs:
- id
- incoming_message_id    → incoming_messages (Fremdschlüssel)
- status                 pending / processing / done / failed
- attempts               Anzahl Versuche (max. 3)
- duration_seconds       Whisper-berechnete Audiodauer
- cost_usd               Berechnete Kosten ($0.006 × Minuten)
- last_error             Fehlermeldung bei Scheitern
- created_at / updated_at
```

---

### Komponentenstruktur

```
Neu: src/lib/transcription-worker.ts
  (parallel zu media-worker.ts — gleiche Queue-Logik, andere Aktion)

Neu: src/app/api/admin/whatsapp/transcription-worker/route.ts
  POST — startet eine Worker-Iteration (für Admin-UI + Cron)

Erweiterung: src/lib/media-worker.ts
  Nach erfolgreichem Audio-Download:
  → transcription_jobs (pending) anlegen

Erweiterung: Admin-Panel (PROJ-8 Seite)
  + Tab "Transkriptions-Log"
  + Spalten: Datum, Absender, Dauer, Status, Kosten

Erweiterung: Begehungs-Erfassung (PROJ-3 Seite)
  + Transkript-Feld (lesbar, editierbar)
  + "Transkript bearbeiten"-Button → Textarea
```

---

### Tech-Entscheidungen

| Entscheidung | Warum |
|---|---|
| **Bestehende DB-Queue-Pattern** (keine externe Queue wie BullMQ) | Gleiche Struktur wie `media_jobs` — kein neues Infrastruktur-Wissen nötig, Self-hosted-kompatibel |
| **OpenAI Whisper `whisper-1`** | Beste Erkennungsqualität für Deutsch + Fachsprache; Pay-per-Use passt zum Budget |
| **Kein ffmpeg nötig (Phase 1)** | Whisper akzeptiert `.ogg` direkt — WhatsApp sendet standardmäßig ogg/Opus; ffmpeg als optionaler Fallback wenn nötig |
| **Sprache fix auf `de`** | Kein automatisches Sprachdetektieren — verhindert falsche Erkennung bei Baulärm |
| **WhatsApp-Rückmeldung** | Bestätigung an Mitarbeiter nach Transkription (erste 100 Zeichen) — schafft Vertrauen ins System |
| **Kosten-Tracking in DB** | $0.006/min × Audiodauer — monatliche Übersicht im Admin-Panel ohne externes Tool |
| **Claude für nachgelagerte Extraktion** | Claude (nicht Whisper) analysiert das fertige Transkript in PROJ-3 — klare Aufgabentrennung |

---

### Neue Abhängigkeiten

| Paket | Zweck |
|---|---|
| `openai` | Whisper API Client |

Kein weiteres Paket nötig — ffmpeg optional, nur bei Format-Problemen erforderlich.

---

### Neue Umgebungsvariablen

```
OPENAI_API_KEY=sk-...
```

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
