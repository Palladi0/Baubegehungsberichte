# PROJ-10: Automatische Projektzuordnung

## Status: Approved
**Created:** 2026-04-21
**Last Updated:** 2026-04-28

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

### Kontext & Ausgangslage

PROJ-8 hat die Webhook-Pipeline aufgebaut:
```
Twilio → /api/webhooks/twilio → incoming_messages (DB) → media_jobs (Queue) → Media Worker
```
PROJ-9 verlängert sie um:
```
Media Worker (audio) → transcription_jobs (Queue) → Transcription Worker → incoming_messages.transcript
```

PROJ-10 hängt sich ans Ende beider Pfade und ergänzt einen dritten asynchronen Schritt: die Projektzuordnung.

---

### Datenfluss (End-to-End)

```
1. Twilio Webhook (PROJ-8, bestehend — wird erweitert)
   │
   ├── NEU: ClarificationCheck
   │     Hat dieser Absender eine offene Klärung (< 30 Min)?
   │     ├── JA  → als Klärungsantwort behandeln → früh beenden
   │     └── NEIN → normaler Fluss
   │
   └── Normaler Fluss
         → incoming_messages (assignment_status = pending)
         → media_jobs (falls Medien vorhanden)

2. Media Worker (PROJ-8, bestehend — wird erweitert)
   Nach erfolgreichem Download:
   ├── Typ audio → transcription_jobs anlegen (PROJ-9)
   └── Typ text/foto → assignment_jobs anlegen (NEU)

3. Transcription Worker (PROJ-9, nach Fertigstellung — wird erweitert)
   Nach erfolgreichem Transkript:
   └── assignment_jobs anlegen (NEU)

4. Assignment Worker (NEU)
   ├── Hashtag im text_content? → Projekt suchen → zuordnen
   ├── Hashtag im transcript?   → Projekt suchen → zuordnen
   ├── Absender eindeutig einem Projekt zugeordnet? → automatisch zuordnen
   └── Sonst → WhatsApp-Klärungsanfrage senden + awaiting_clarification setzen

5. Klärungsantwort (via Twilio Webhook, Schritt 1 — ClarificationCheck)
   → Ursprungsnachricht dem genannten Projekt zuordnen
   → Bestätigung an Absender senden

6. Admin-Dashboard (Erweiterung von PROJ-8 Admin-Seite)
   └── Tab "Nicht zugeordnet": manuelle Zuordnung per Dropdown
```

---

### Datenbank-Änderungen

**Erweiterung der bestehenden Tabelle `incoming_messages`** — 5 neue Felder:

```sql
ALTER TABLE incoming_messages ADD COLUMN
  project_id              UUID REFERENCES projects(id) ON DELETE SET NULL,
  assignment_status       TEXT NOT NULL DEFAULT 'pending'
                            CHECK (assignment_status IN (
                              'pending', 'assigned', 'awaiting_clarification',
                              'manual_required', 'failed'
                            )),
  assignment_method       TEXT
                            CHECK (assignment_method IN (
                              'hashtag_text', 'hashtag_transcript',
                              'sender_unique', 'manual', 'clarification_reply'
                            )),
  clarification_attempts  INTEGER NOT NULL DEFAULT 0,
  clarification_sent_at   TIMESTAMPTZ;
```

Indizes:
```sql
CREATE INDEX idx_inc_msg_assignment_status ON incoming_messages (assignment_status);
CREATE INDEX idx_inc_msg_project           ON incoming_messages (project_id);
CREATE INDEX idx_inc_msg_clarification     ON incoming_messages (sender_phone, assignment_status, clarification_sent_at);
```

**Neue Tabelle `assignment_jobs`** — gleiche Struktur wie `media_jobs`/`transcription_jobs`:

```sql
CREATE TABLE assignment_jobs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incoming_message_id UUID NOT NULL REFERENCES incoming_messages(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  attempts            INTEGER NOT NULL DEFAULT 0,
  last_error          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE assignment_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service-Rolle Vollzugriff assignment_jobs" ON assignment_jobs
  FOR ALL USING (auth.role() = 'service_role');
CREATE INDEX idx_assignment_jobs_status     ON assignment_jobs (status);
CREATE INDEX idx_assignment_jobs_message_id ON assignment_jobs (incoming_message_id);
```

**Vorausgesetzte Tabellen aus PROJ-2** (müssen existieren):
- `projects`: `id`, `slug` (unique, max. 20 Zeichen), `is_archived`, `archived_at`
- `project_members`: `project_id` (FK → projects), `user_id` (FK → auth.users)

---

### Komponenten-Struktur

```
Neu:      src/lib/assignment-worker.ts
  ├── runAssignmentWorker()           Polling alle 30 Sek., liest pending assignment_jobs
  ├── assignMessage(messageId)        Kernlogik — führt Prioritätsreihenfolge durch
  ├── extractHashtags(text)           Regex /#([A-Za-z0-9\-]+)/g → string[]
  ├── findProjectsByHashtags(slugs)   ILIKE-Abfrage gegen projects.slug
  ├── checkSenderUniqueProject(uid)   project_members → prüft Eindeutigkeit
  ├── sendClarificationRequest(phone, options[])  Twilio → WhatsApp-Nachricht
  └── resolveWithClarification(origMsgId, slug)   Zuordnung + Bestätigung

Neu:      src/app/api/admin/whatsapp/assignment-worker/route.ts
  POST    Manueller Worker-Trigger (für Admin-UI)

Neu:      src/app/api/admin/whatsapp/unassigned/route.ts
  GET     Liste nicht-zugeordneter Nachrichten (assignment_status IN pending, awaiting_clarification, manual_required, failed)

Neu:      src/app/api/admin/whatsapp/messages/[id]/assign/route.ts
  POST    Body: { project_id }  → manuelle Zuordnung durch Admin

Erweiterung: src/app/api/webhooks/twilio/route.ts
  Nach SenderLookup, vor MessageLogger:
  + ClarificationCheck: offene Klärung für diesen Absender (< 30 Min)?
    ├── JA  → resolveWithClarification() → TwiML-Antwort → 200 (kein neuer Job)
    └── NEIN → weiter im normalen Fluss, incoming_messages.assignment_status = 'pending'

Erweiterung: src/lib/media-worker.ts   (nach erfolgreichem Download)
  + if message_type IN ('text', 'foto') → assignment_jobs anlegen

Erweiterung: src/lib/transcription-worker.ts  (nach erfolgreichem Transkript)
  + assignment_jobs anlegen

Erweiterung: Admin-Panel (/admin/whatsapp)
  + Tab "Nicht zugeordnet"
    ├── Tabelle: Zeitstempel, Absender, Typ, Kurzinhalt, Status
    └── Dropdown pro Zeile: Projekt auswählen → POST .../assign
```

---

### Zuordnungs-Logik (Assignment Worker — Kernalgorithmus)

```
assignMessage(messageId):

  1. Nachricht laden (text_content + transcript)

  2. Hashtags extrahieren aus text_content
     Falls gefunden → Projekte per ILIKE laden
       Kein Match         → Klärung: "Unbekanntes Kürzel, bitte wiederholen."
       Genau 1 Match      → zuordnen (method: hashtag_text)
       Mehrere Matches    → Klärung: "Bitte antworten: 1. BV-23-HH oder 2. MF-24-B"

  3. Hashtags extrahieren aus transcript (nur audio)
     [gleiche Logik wie Schritt 2, method: hashtag_transcript]

  4. Absender-Eindeutigkeit prüfen
     project_members WHERE user_id = sender.user_id
     JOIN projects WHERE is_archived = false
     Count = 1 → zuordnen (method: sender_unique)
     Count ≠ 1 → weiter

  5. Klärungsverfahren einleiten
     attempts < 3:
       → WhatsApp: "Für welches Projekt? Bitte antworten mit Kürzel (z. B. BV-23-Hamburg)."
       → assignment_status = awaiting_clarification
       → clarification_sent_at = NOW()
       → clarification_attempts++
     attempts ≥ 3:
       → assignment_status = failed
       → Admin-Dashboard: Aufgabe "Manuell zuordnen"
```

**Klärungsantwort (im Webhook):**
```
  1. Absender hat offene Klärung (< 30 Min)?
     NEIN → normaler Fluss
     JA   →
       a. Text der Antwort als Projekt-Slug parsen (strip #, ILIKE)
       b. Projekt gefunden + aktiv? → Ursprungsnachricht zuordnen (method: clarification_reply)
                                    → WhatsApp: "✓ Zugeordnet zu [Projektkürzel]"
       c. Kein Match / archiviert?  → attempts++ (max. 3)
                                    → erneute Klärungsfrage oder status=failed
```

---

### Technische Entscheidungen

| Entscheidung | Gewählt | Begründung |
|---|---|---|
| **Klärungsdetection** | Im Webhook (synchron, vor MessageLogger) | Niedrigste Latenz; Antwort in < 1 Sek.; kein Polling-Delay für Nutzer |
| **Queue-Muster** | DB-basierte `assignment_jobs` (kein Redis/BullMQ) | Konsistenz mit `media_jobs`/`transcription_jobs`; Self-hosted-kompatibel |
| **Hashtag-Matching** | PostgreSQL `ILIKE` / `LOWER()` | Case-insensitive korrekt für alle Buchstaben, auch Deutsch |
| **Mehrfach-Hashtags** | WhatsApp-Nummerierung (1., 2., ...) | Kein UI-Aufwand; funktioniert auf jedem Phone |
| **Clarification-Timeout** | 30 Minuten | Spec-Vorgabe; verhindert Verwechslung mit alter Konversation |
| **Audit-Log** | Felder in `incoming_messages` (method + status) | MVP-Vereinfachung; keine separate Log-Tabelle nötig |
| **Archivierte Projekte** | Fehler-Reply per WhatsApp | Klares Feedback; kein stilles Scheitern |

---

### Abhängigkeiten & Build-Reihenfolge

```
PROJ-2 (Projektverwaltung) — muss zuerst gebaut werden
  → liefert projects.slug + project_members-Tabelle

PROJ-9 (Sprach-Transkription) — parallel oder vorher
  → liefert incoming_messages.transcript
  → PROJ-10 erweitert den Transcription Worker

PROJ-10 (dieses Feature) — last
  → erweitert Webhook, Media Worker und Transcription Worker
  → fügt Assignment Worker hinzu
```

---

### Neue Abhängigkeiten (Pakete)

Keine — alle nötigen Pakete (Twilio, Supabase) sind bereits installiert.

---

### Neue Umgebungsvariablen

Keine — alle nötigen Variablen (Twilio Auth, Supabase Service Role) sind bereits in PROJ-8 eingeführt.

## Implementation Notes (2026-04-23)

### Was gebaut wurde
- **DB-Migration** (`supabase/migrations/20260423_proj10_assignment.sql`): `incoming_messages` um 5 Felder erweitert (`project_id`, `assignment_status`, `assignment_method`, `clarification_attempts`, `clarification_sent_at`); neue `assignment_jobs`-Tabelle mit RLS und Trigger
- **Assignment Worker** (`src/lib/assignment-worker.ts`): Vollständiger Prioritätsalgorithmus (Hashtag Text → Hashtag Transkript → Absender-Eindeutigkeit → Klärungsverfahren); `resolveWithClarification()` + `hasPendingClarification()` für Webhook-Integration
- **API-Routen**: `POST /api/admin/whatsapp/assignment-worker` (manueller Trigger), `GET /api/admin/whatsapp/unassigned` (Liste), `POST /api/admin/whatsapp/messages/[id]/assign` (manuelle Zuordnung)
- **Twilio Webhook** (`src/app/api/webhooks/twilio/route.ts`): ClarificationCheck vor MessageLogger eingefügt
- **Media Worker** (`src/lib/media-worker.ts`): Für Text/Foto-Nachrichten nach erfolgreichem Download `assignment_jobs` anlegen
- **Transcription Worker** (`src/lib/transcription-worker.ts`): Nach erfolgreichem Transkript `assignment_jobs` anlegen
- **ZuordnungsCard** (`src/components/whatsapp/ZuordnungsCard.tsx`): Admin-UI mit Tabelle aller nicht-zugeordneten Nachrichten, Projekt-Dropdown pro Zeile, manueller Worker-Trigger
- **Admin WhatsApp Page**: `ZuordnungsCard` prominent über dem Nachrichten-Log eingebunden

### Abweichungen vom Spec
- Die `projects`-Tabelle heißt im existierenden Schema `projekte` (statt `projects`) und `kuerzel` (statt `slug`) — alle Queries entsprechend angepasst
- `projekt_mitarbeiter` verwendet `nutzer_id` (statt `user_id`)
- Für Text-Nachrichten (ohne Medien) wird `assignment_jobs` direkt im Webhook angelegt (nicht über Media Worker), da kein Download nötig ist

## QA Test Results

**QA-Datum:** 2026-04-28 (Re-QA nach Bug-Fixes: 2026-04-28)
**Tester:** /qa (Claude)
**Ergebnis:** ✅ APPROVED — alle 4 Bugs behoben, keine offenen Bugs

### Acceptance Criteria — Testergebnisse

| # | Kriterium | Ergebnis |
|---|-----------|---------|
| 1 | Hashtag-Erkennung ist case-insensitive und erkennt `#` als Präfix | ✅ PASS |
| 2 | Prioritätsreihenfolge: Hashtag Text → Hashtag Transkript → Absender-Eindeutigkeit → Klärung | ✅ PASS |
| 3 | Mehrere Hashtags → alle erkannten Projekte als nummerierte Liste an Absender | ✅ PASS |
| 4 | Unbekannte Hashtags → manuelles Klärungsverfahren | ✅ PASS |
| 5 | Klärungsverfahren: WhatsApp-Antwort mit Kürzel-Anfrage | ✅ PASS |
| 6 | Antwort auf Klärung ordnet Ursprungsnachricht automatisch zu | ✅ PASS |
| 7 | Nicht-zugeordnete Nachrichten erscheinen im Admin-Dashboard | ✅ PASS |
| 8 | Manuelle Zuordnung via Dropdown | ✅ PASS |
| 9 | assignment_method wird für jede Zuordnung geloggt | ✅ PASS |

### Edge Cases getestet

| Edge Case | Ergebnis |
|-----------|---------|
| Archiviertes Projekt in Klärungsantwort → Fehlermeldung | ✅ PASS |
| 3 Fehlversuche → assignment_status = 'failed' | ✅ PASS |
| Mehrere Nachrichten kurz hintereinander → jede einzeln | ✅ PASS |
| Absender mehreren Projekten zugeordnet, kein Hashtag → Klärung | ✅ PASS |

### Bugs gefunden & behoben

#### BUG-1 (Medium) ✅ BEHOBEN — `findProjectsByHashtags` filtert keine archivierten Projekte
- **Beschreibung:** Beim Hashtag-Matching im Assignment Worker (Schritt 2/3) wurde `projekte.archived_at` nicht geprüft. Wenn ein Hashtag einem archivierten Projekt entsprach, wurde die Nachricht still diesem Projekt zugeordnet.
- **Fix:** `findProjectsByHashtags` selektiert jetzt `archived_at`; `processAssignmentJob` splittet in `aktive`/`archiviert` und sendet bei archiviertem Match eine WhatsApp-Fehlermeldung.
- **Test:** `src/lib/assignment-worker.test.ts` — BUG-1-Describe-Block mit 2 Tests ✅

#### BUG-2 (Medium) ✅ BEHOBEN — Doppelte WhatsApp-Nachricht bei unbekanntem Hashtag
- **Beschreibung:** Bei unbekanntem Hashtag wurden zwei WhatsApp-Nachrichten gesendet (extra `sendWhatsApp` + `sendClarificationRequest`).
- **Fix:** Die redundante `sendWhatsApp`-Nachricht wurde entfernt; nur noch `sendClarificationRequest` sendet die Klärungsanfrage.
- **Test:** `src/lib/assignment-worker.test.ts` — BUG-2-Describe-Block ✅

#### BUG-3 (Low) ✅ BEHOBEN — Assign-Route prüft nicht ob Nachricht existiert
- **Beschreibung:** `POST /api/admin/whatsapp/messages/[id]/assign` gab `{ ok: true }` zurück, auch wenn die Message-ID nicht existierte.
- **Fix:** Expliziter Existenz-Check via `SELECT … maybeSingle()` vor dem Update; gibt 404 zurück wenn nicht gefunden.
- **Test:** `src/app/api/admin/whatsapp/messages/[id]/assign/route.test.ts` — "404 wenn Nachricht nicht existiert (BUG-3 Fix)" ✅

#### BUG-4 (Low) ✅ BEHOBEN — Kein `assigned_at`-Timestamp im Zuordnungs-Protokoll
- **Beschreibung:** Kein expliziter `assigned_at`-Timestamp beim Zuordnungs-Update.
- **Fix:** Migration `supabase/migrations/20260429_proj10_bug_fixes.sql` fügt `assigned_at TIMESTAMPTZ` zu `incoming_messages` hinzu; `assignMessage()` und manuelle Assign-Route setzen jetzt `assigned_at: new Date().toISOString()`.
- **Test:** `src/app/api/admin/whatsapp/messages/[id]/assign/route.test.ts` — BUG-4-Fix-Test ✅

### Security Audit

| Prüfpunkt | Ergebnis |
|-----------|---------|
| Alle Admin-API-Routen erfordern Auth via `requireAdmin` | ✅ |
| Input-Validierung mit Zod auf assign-Route | ✅ |
| Archivierte Projekte können nicht manuell zugewiesen werden (422) | ✅ |
| RLS auf `assignment_jobs` (nur Service-Rolle) | ✅ |
| Twilio-Signatur-Validierung im Webhook | ✅ |
| Keine Secrets in API-Responses | ✅ |
| ClarificationCheck: 30-Min-Timeout verhindert versehentliche Zuordnung | ✅ |

### Automatisierte Tests

| Test-Suite | Anzahl | Ergebnis |
|-----------|--------|---------|
| Vitest Unit/Integration | 197 Tests gesamt | ✅ alle grün |
| Playwright E2E PROJ-10 | 13 Tests (1 pass, 12 skip*) | ✅ |
| Regression (alle Tests) | 197 | ✅ keine Regressionen |

*E2E-Tests skippen wenn keine Supabase-Session vorhanden (identisches Verhalten wie PROJ-8/9)

### Neue Test-Dateien
- `src/lib/assignment-worker.test.ts` — `extractHashtags`, `hasPendingClarification`, `resolveWithClarification`
- `src/app/api/admin/whatsapp/assignment-worker/route.test.ts` — Worker-Trigger API
- `src/app/api/admin/whatsapp/unassigned/route.test.ts` — Unassigned-List API
- `src/app/api/admin/whatsapp/messages/[id]/assign/route.test.ts` — Manual-Assign API
- `tests/PROJ-10-automatische-projektzuordnung.spec.ts` — E2E-Tests für ZuordnungsCard
- `vitest.config.ts` erweitert um `server-only`-Stub-Alias
- `src/test/server-only-stub.ts` — Stub für Test-Umgebung

### Produktions-Bereitschaft

**Entscheidung: APPROVED** — Alle 4 Bugs wurden behoben und durch neue Tests verifiziert. 197/197 Vitest-Tests grün. Kein offener Bug mehr.

## Deployment
_To be added by /deploy_
