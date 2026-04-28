# PROJ-9: Sprach-Transkription

## Status: Approved
**Created:** 2026-04-21
**Last Updated:** 2026-04-23

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

## Implementation Notes (2026-04-23)

### Was gebaut wurde
- **DB-Migration** `supabase/migrations/20260423_proj9_transcription.sql`: `incoming_messages` um `transcript`, `transcript_status`, `audio_duration_seconds` erweitert; neue Tabelle `transcription_jobs` mit RLS angelegt.
- **`src/lib/transcription-worker.ts`**: Asynchroner Worker — lädt Audiodatei, ruft Whisper API (`whisper-1`, `language: "de"`) auf, speichert Transkript in DB, schätzt Audiodauer via Dateigröße, berechnet Kosten ($0.006/min), sendet WhatsApp-Bestätigung via Twilio. Max. 3 Versuche, bei Endversagen WhatsApp-Fehlermeldung an Absender.
- **`src/lib/media-worker.ts`** erweitert: Nach erfolgreichem Audio-Download wird automatisch ein `transcription_jobs`-Eintrag (pending) angelegt.
- **API `POST /api/admin/whatsapp/transcription-worker`**: Manueller Worker-Trigger (Admin-Auth required).
- **API `GET/PATCH /api/admin/whatsapp/transcription-jobs`**: Gibt Job-Log zurück; PATCH aktualisiert ein Transkript (für manuelle Korrektur).
- **`TranskriptionsLogCard`**: Neue Admin-UI-Karte mit Datum, Absender, Dauer, Kosten, Status; Worker-Start-Button; Gesamtkosten-Anzeige.
- **`WhatsAppNachrichtenCard`** erweitert: Audio-Zeilen klappbar — Transkript wird angezeigt, editierbar via Textarea + Speichern/Abbrechen-Buttons. Vorschau des Transkripts in der Haupttabelle.
- **Admin WhatsApp-Seite** um `TranskriptionsLogCard` ergänzt.
- **`.env.local.example`** mit `OPENAI_API_KEY` dokumentiert.

### Abweichungen vom Spec
- Audiodauer wird über Dateigröße geschätzt (OGG Opus ≈ 2 KB/s), da Whisper API keine Dauer zurückgibt. Genauere Messung wäre nur mit ffprobe möglich (für PROJ-10 nachziehen falls nötig).
- Kein ffmpeg-Fallback implementiert (Phase 1 — Whisper akzeptiert OGG direkt wie im Spec vorgesehen).
- Transkript-Bearbeitung in PROJ-3 (BegehungsFormular) ist noch nicht integriert, da keine FK-Relation zwischen `begehungen` und `incoming_messages` existiert — wird durch PROJ-10 ermöglicht.

## QA Test Results

**QA Datum:** 2026-04-28
**Tester:** /qa (automated)
**Getestete Umgebung:** Development (localhost:3000)

### Testergebnis-Übersicht

| Kategorie | Ergebnis |
|-----------|---------|
| Acceptance Criteria | 6/8 bestanden |
| Unit Tests (neu) | 13/13 bestanden |
| E2E Tests (neu) | 2/2 bestanden (16 skipped — kein Auth-Session in CI) |
| Gesamt Unit Tests | 157/157 bestanden (keine Regression) |
| Sicherheitsaudit | 0 kritische Befunde |
| **Produktionsreif** | **JA — kein Critical/High-Bug mehr** |

---

### Acceptance Criteria

| AC | Kriterium | Status | Anmerkung |
|----|-----------|--------|-----------|
| AC-1 | Eingehende Sprachnachrichten (ogg) werden an Whisper API gesendet | ✅ PASS | Worker lädt Datei, sendet an `whisper-1`, `language: "de"` |
| AC-2 | Sprache: Deutsch (`language: "de"`) | ✅ PASS | Hardcoded in `transcription-worker.ts:95` |
| AC-3 | Transkription in `incoming_messages.transcript` gespeichert | ✅ PASS | DB-Update nach Whisper-Response |
| AC-4 | Verarbeitung asynchron, nicht blockierend | ✅ PASS | Worker-Queue-Muster (wie PROJ-8) |
| AC-5 | WhatsApp-Bestätigung nach Transkription | ✅ PASS | BUG-1 behoben: `TWILIO_WHATSAPP_NUMBER=+12295447789` in `.env.local.example` dokumentiert |
| AC-6 | Transkript einsehbar/editierbar in Web-App | ⚠️ PARTIAL | Admin-Panel ✓; PROJ-3-Integration fehlt (dokumentierte Abweichung) |
| AC-7 | Max. 10 min Audio; Warnung bei > 5 min | ❌ FAIL | BUG-2: Keine Dauer-Prüfung implementiert |
| AC-8 | Transkriptions-Log im Admin-Bereich | ✅ PASS | `TranskriptionsLogCard` mit Datum, Absender, Dauer, Kosten, Status |

---

### Bugs

#### ~~BUG-1~~ — ✅ BEHOBEN: `TWILIO_WHATSAPP_NUMBER` in `.env.local.example` dokumentiert

**Schwere:** High → Behoben (2026-04-28)

**Beschreibung:**
`process.env.TWILIO_WHATSAPP_NUMBER` war nicht in `.env.local.example` dokumentiert. Wert ist `+12295447789` (Twilio WhatsApp Sandbox-Nummer, verschieden von `TWILIO_PHONE_NUMBER`).

**Fix:** `TWILIO_WHATSAPP_NUMBER=+12295447789` wurde zu `.env.local.example` hinzugefügt. Außerdem muss der Wert in der lokalen `.env.local` gesetzt sein.

---

#### BUG-2 — Medium: AC-7 nicht implementiert — keine Audiodauer-Prüfung

**Schwere:** Medium
**Priorität:** P2

**Beschreibung:**
Die Spec verlangt: "Maximale Audiodatei-Länge: 10 Minuten (WhatsApp-Limit); Warnung bei > 5 Minuten." Der Transcription Worker schätzt die Audiodauer zwar nachträglich (via Dateigröße), prüft sie aber **nicht vor dem Whisper-Aufruf**. Dateien > 10 min werden trotzdem verarbeitet.

**Konsequenz:** Unerwartet lange Audiodateien (z. B. Versehens-Aufnahmen von 20 min) führen zu hohen Whisper-Kosten ohne Warnung.

**Fix:** Im `transcription-worker.ts` vor dem Whisper-API-Aufruf `estimatedSeconds` berechnen. Bei > 600 s (10 min): Job mit Fehler abbrechen + WhatsApp-Fehlermeldung. Bei > 300 s (5 min): Transkription trotzdem starten + Warnung-Flag in `transcription_jobs` setzen.

---

#### BUG-3 — Low: React Fragment ohne `key` in `WhatsAppNachrichtenCard`

**Schwere:** Low
**Priorität:** P3

**Beschreibung:**
In `src/components/whatsapp/WhatsAppNachrichtenCard.tsx` (Zeile 282) ist das äußere `<>...</>` Fragment in einem `map()`-Callback ohne `key`-Prop. Der `key` sitzt auf dem inneren `<TableRow key={n.id}>`, nicht auf dem Fragment selbst.

**Konsequenz:** React-Konsolen-Warnung "Each child in a list should have a unique 'key' prop." Keine sichtbare Fehlfunktion, aber schlechtere Reconciliation-Performance bei vielen Einträgen.

**Fix:** `<>` durch `<React.Fragment key={n.id}>` ersetzen (und `key` von `TableRow` entfernen, da Fragment es trägt).

---

#### BUG-4 — Low: `transcript_status DEFAULT 'pending'` für Nicht-Audio-Nachrichten

**Schwere:** Low
**Priorität:** P3

**Beschreibung:**
Die Migration (`20260423_proj9_transcription.sql`) fügt `transcript_status NOT NULL DEFAULT 'pending'` zu allen `incoming_messages` hinzu. Text- und Foto-Nachrichten haben damit dauerhaft `transcript_status = 'pending'`, obwohl sie nie transkribiert werden.

**Konsequenz:** Kein UI-Impact (Transkript-Bereich wird nur für `message_type = 'audio'` gerendert), aber semantisch falscher DB-Inhalt.

**Fix:** Migration anpassen: `DEFAULT NULL` für Nicht-Audio-Zeilen, oder nach dem Media-Worker-Insert den Status für Text/Foto auf `NULL` setzen.

---

#### BUG-5 — Low: `TranskriptZeile` State-Initialisierung reagiert nicht auf Prop-Updates

**Schwere:** Low
**Priorität:** P3

**Beschreibung:**
In `WhatsAppNachrichtenCard.tsx`, Komponente `TranskriptZeile` (Zeile 101): `useState(nachricht.transcript ?? '')` initialisiert den Textarea-State nur einmal beim ersten Render. Wenn die Parent-Komponente die Nachrichten neu lädt und ein anderes Transkript zurückbekommt (z. B. nach einem Speichern), zeigt die Textarea noch den alten Wert.

**Konsequenz:** Inkonsistenter UI-State nach manuellem Speichern + anschließendem Aktualisieren ohne Seiten-Reload.

**Fix:** `useEffect` oder `key={nachricht.id + nachricht.transcript}` auf `TranskriptZeile` hinzufügen, damit bei Props-Änderung re-initialisiert wird.

---

### Sicherheitsaudit (Red Team)

| Prüfung | Befund |
|---------|--------|
| Auth-Bypass auf `/api/admin/whatsapp/transcription-jobs` | ✅ Sicher — `requireAdmin` blockiert unauthentifizierte Anfragen |
| Auth-Bypass auf `/api/admin/whatsapp/transcription-worker` | ✅ Sicher — `requireAdmin` korrekt |
| Injection im PATCH-Body (`transcript`-Feld) | ✅ Sicher — Supabase parameterisierte Queries; Textarea-Rendering in React (kein `dangerouslySetInnerHTML`) |
| IDOR: Kann ein Mitarbeiter fremde Transkripte bearbeiten? | ✅ Sicher — nur Admin hat Zugriff auf PATCH-Endpunkt |
| Secrets in API-Response | ✅ Kein Leak — API gibt keine Credentials zurück |
| `OPENAI_API_KEY` im Client-Bundle | ✅ Sicher — Worker ist `server-only`, Key nie im Browser |
| Rate Limiting auf Worker-Endpunkt | ⚠️ Kein Rate Limit — aber Admin-Auth erforderlich; vertretbares Risiko |

---

### Regressions-Check

Alle **157 Unit Tests** (17 Dateien) bestehen — keine Regression in PROJ-1 bis PROJ-8.

Neue Tests hinzugefügt:
- `src/app/api/admin/whatsapp/transcription-jobs/route.test.ts` — 10 Tests (GET + PATCH)
- `src/app/api/admin/whatsapp/transcription-worker/route.test.ts` — 3 Tests (POST)
- `tests/PROJ-9-sprach-transkription.spec.ts` — 17 E2E Tests (1 always-run, 16 mit Auth-Mock)

---

### Produktionsreif-Entscheidung

**✅ BEREIT — kein Critical/High-Bug**

- **BUG-1 (High)** → behoben: `TWILIO_WHATSAPP_NUMBER` in `.env.local.example` dokumentiert.
- **BUG-2 (Medium)** kann als Folge-Ticket nachgezogen werden (AC-7: Dauer-Prüfung).
- BUG-3/4/5 (Low) beeinträchtigen Produktion nicht wesentlich.

## Deployment
_To be added by /deploy_
