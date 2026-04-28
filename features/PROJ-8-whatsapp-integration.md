# PROJ-8: WhatsApp-Integration (Twilio Sandbox)

## Status: Deployed
**Created:** 2026-04-21
**Last Updated:** 2026-04-21

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — eingehende Nachrichten werden einem Nutzer-Account zugeordnet
- Requires: PROJ-2 (Projektverwaltung) — Projektzuordnung per Hashtag
- Requires: PROJ-3 (Begehungs-Erfassung) — Nachrichten werden in Begehungen umgewandelt

## Beschreibung
Mitarbeiter senden Sprachnachrichten und Fotos über einen zentralen WhatsApp-Kanal (Twilio Sandbox). Der Server empfängt eingehende Nachrichten über einen Webhook, speichert Medien-Dateien und Text-Nachrichten und stellt sie für die weitere Verarbeitung (Transkription, KI-Extraktion, Bericht) bereit. Für den Betrieb ist eine Vorab-Registrierung der Telefonnummern aller Mitarbeiter in Twilio notwendig.

## User Stories
- Als **Mitarbeiter** möchte ich eine WhatsApp-Nachricht mit einem Hashtag an die zentrale Büronummer senden, damit meine Nachricht automatisch dem richtigen Projekt zugeordnet wird.
- Als **Mitarbeiter** möchte ich Fotos direkt aus WhatsApp an die zentrale Nummer senden, damit sie automatisch in das System hochgeladen werden.
- Als **Admin** möchte ich Mitarbeiter-Telefonnummern im System hinterlegen, damit eingehende WhatsApp-Nachrichten einem Nutzer-Account zugeordnet werden können.
- Als **System** möchte ich den Eingang einer Nachricht automatisch per WhatsApp bestätigen, damit Mitarbeiter wissen, dass ihre Nachricht angekommen ist.
- Als **Admin** möchte ich die Twilio-Webhook-Konfiguration im Admin-Bereich verwalten, damit keine manuelle Konfiguration im Code nötig ist.

## Acceptance Criteria
- [ ] Twilio Sandbox Webhook ist konfiguriert und empfängt POST-Requests von Twilio
- [ ] Webhook-Signatur wird validiert (Twilio HMAC-Signatur-Check) — keine unauthentifizierten Requests
- [ ] Eingehende Nachricht-Typen werden unterstützt: Text-Nachrichten, Sprachnachrichten (ogg/mp4), Fotos (JPEG/PNG)
- [ ] Empfangene Medien-Dateien werden sofort lokal gespeichert (unter `/var/uploads/whatsapp/`)
- [ ] Absender-Telefonnummer wird gegen die hinterlegten Mitarbeiter-Nummern abgeglichen
- [ ] Unbekannte Absender erhalten automatische WhatsApp-Antwort: „Ihre Nummer ist nicht im System registriert. Bitte wenden Sie sich an den Administrator."
- [ ] Bekannte Absender erhalten Eingangsbestätigung: „✓ Nachricht empfangen für [Projektkürzel]. Verarbeitung läuft..."
- [ ] Alle eingehenden Nachrichten werden in einer `incoming_messages`-Tabelle geloggt (Timestamp, Absender, Typ, Dateipfad)
- [ ] Admin-UI: Mitarbeiter-Telefonnummern hinzufügen/entfernen, Twilio Webhook-URL anzeigen

## Edge Cases
- Was passiert, wenn Twilio eine Nachricht doppelt sendet (Retry)? → Idempotenz: Doppelte Nachrichten werden anhand der Twilio Message-SID erkannt und ignoriert.
- Was passiert, wenn eine Datei von Twilio nicht heruntergeladen werden kann? → Nachricht wird trotzdem geloggt; Medien-Download wird 3x wiederholt; bei Misserfolg: Admin-Alert.
- Was passiert, wenn der Webhook nicht erreichbar ist (Server down)? → Twilio wiederholt den Webhook bis zu 11 Mal über 24 Stunden; keine Datenverlust.
- Was passiert, wenn der Speicherplatz auf dem Server voll ist? → Eingehende Medien werden abgelehnt; WhatsApp-Antwort an Absender: „System temporär nicht verfügbar."
- Was passiert mit Gruppen-Nachrichten? → Nicht unterstützt (MVP); nur 1:1-Nachrichten an die Büronummer werden verarbeitet.

## Technical Requirements
- Twilio SDK für Node.js/Python für Webhook-Verarbeitung
- Webhook-URL muss HTTPS-gesichert sein (kein HTTP)
- Medien-Download von Twilio-URLs mit Auth-Token (URLs sind nur kurzzeitig gültig)
- Maximale Verarbeitungszeit pro Webhook-Aufruf: < 5 Sekunden (Twilio-Timeout-Limit)
- Asynchrone Verarbeitung: Medien-Download und KI-Verarbeitung erfolgen außerhalb des Webhook-Handlers (Queue)
- API-Endpunkte: POST /webhooks/twilio (öffentlich, aber signaturgeschützt)

---

## Tech Design (Solution Architect)

### Überblick
Das Feature besteht aus drei Teilen: (1) einem HMAC-gesicherten Webhook-Empfänger, (2) einem asynchronen Hintergrund-Worker für den Medien-Download, und (3) einer Admin-UI zur Verwaltung von Telefonnummern und Monitoring.

### Komponenten-Struktur

```
Backend (API-Schicht)
└── POST /api/webhooks/twilio  (öffentlich, HMAC-signaturgeschützt)
    ├── TwilioSignatureValidator     Prüft HMAC-Signatur — lehnt ungültige Requests ab
    ├── MessageParser                Erkennt Nachrichtentyp: Text / Audio / Foto
    ├── IdempotencyCheck             Prüft Twilio-Message-SID → ignoriert Duplikate
    ├── SenderLookup                 Gleicht Absender-Telefon mit Mitarbeiter-DB ab
    ├── MessageLogger                Schreibt Nachricht in incoming_messages-Tabelle
    ├── JobDispatcher                Stellt Medien-Download in Job-Queue ein (async)
    └── TwilioResponder              Sendet automatische WhatsApp-Antwort zurück

Hintergrund-Worker (asynchron, polling alle 30 Sekunden)
├── JobQueue-Poller               Liest offene Jobs aus media_jobs-Tabelle
├── MediaDownloader               Lädt Datei von Twilio-URL herunter + speichert lokal
└── RetryHandler                  Bis zu 3 Versuche bei Fehler; danach Admin-Alert

Admin-Bereich (/admin/whatsapp)
├── Webhook-URL-Anzeige           Konfigurierte Twilio-Webhook-URL mit Copy-Button
├── Telefonnummer-Verwaltung
│   ├── Tabelle: Name, Nummer, Status (aktiv/inaktiv), Datum
│   ├── Dialog: Nummer hinzufügen (Mitarbeiter + Nummer)
│   └── Löschen-Button pro Eintrag
└── Nachrichten-Log               Letzte 100 eingegangene Nachrichten
    ├── Spalten: Zeitstempel, Absender, Typ, Status, Fehler
    └── Fehler-Badge bei fehlgeschlagenen Medien-Downloads
```

### Datenmodell

**`phone_registrations`** — Mitarbeiter-Telefonnummer-Zuordnung
- ID, user_id (FK → users), phone_number (E.164-Format), label, is_active, created_at

**`incoming_messages`** — Protokoll aller eingehenden WhatsApp-Nachrichten
- ID, twilio_message_sid (UNIQUE — Idempotenz-Schlüssel), sender_phone, user_id (nullable), message_type (text/audio/foto), text_content, twilio_media_url, local_file_path, status (received/downloading/stored/failed), received_at, processed_at, error_message

**`media_jobs`** — Async Job-Queue für Medien-Download
- ID, incoming_message_id (FK), status (pending/processing/done/failed), attempts, last_error, created_at, updated_at

**Datei-Ablage:** `/var/uploads/whatsapp/YYYY-MM-DD/<typ>_<message-sid>.<ext>`

### Datenfluss

```
Mitarbeiter → WhatsApp → Twilio Sandbox
                              │ POST mit HMAC-Signatur
                              ▼
                  /api/webhooks/twilio
                              │
          1. Signatur prüfen  → ungültig? → 403
          2. Duplikat-Check   → bekannt?  → 200 (ignorieren)
          3. Absender-Lookup
               │
               ├── Unbekannt → Auto-Antwort: "Nicht registriert" + loggen
               └── Bekannt   → Job einreihen + Auto-Antwort: "✓ Empfangen"
                              → 200 OK an Twilio (< 1 Sekunde)

Hintergrund-Worker (alle 30 Sek.)
  1. Offene Jobs aus media_jobs lesen
  2. Medien-Datei von Twilio herunterladen (mit Auth-Token)
  3. Lokal speichern unter /var/uploads/whatsapp/YYYY-MM-DD/
  4. Status → "stored"; bei Fehler: Retry (max. 3x) → Admin-Alert
```

### Technische Entscheidungen

| Entscheidung | Gewählt | Begründung |
|---|---|---|
| Async Queue | DB-basierte Job-Queue (kein Redis) | Self-Hosted-Constraint; 10 Nutzer → kein Redis-Overhead nötig |
| Hintergrund-Worker | Separater Node.js-Prozess (polling) | Einfach, kein zusätzlicher Dienst; Jobs bleiben bei Neustart erhalten |
| Idempotenz | Twilio Message-SID als Unique-Key | Twilio wiederholt Webhooks → verhindert Duplikat-Verarbeitung |
| Signatur-Validierung | Twilio HMAC-SHA1 (offizieller SDK) | Schützt den öffentlichen Endpunkt vor gefälschten Anfragen |
| Telefonnummer-Format | E.164 (+49...) | Twilio sendet immer E.164 → einheitliches Format, kein Matching-Fehler |
| HTTPS | Nginx-Reverse-Proxy + Let's Encrypt | Twilio-Anforderung — auf Infrastruktur-Ebene gelöst, nicht im App-Code |

### Abhängigkeiten (neue Pakete)

| Paket | Zweck |
|---|---|
| `twilio` | Offizielle SDK — Signatur-Validierung + Auto-Antworten senden |

### Abgrenzung (nicht in PROJ-8)
- Sprach-Transkription → PROJ-9
- KI-Extraktion aus Text → PROJ-3
- Automatische Projektzuordnung via Hashtag → PROJ-10
- WhatsApp Business API (Produktion) → PROJ-11

## Implementierungsnotizen

### Erstellte Dateien
- `supabase/migrations/20260422_proj8_whatsapp.sql` — 3 Tabellen: `phone_registrations`, `incoming_messages`, `media_jobs`
- `src/lib/supabase.ts` — aktualisiert: `createServiceClient()` + `createServerClient()` hinzugefügt
- `src/lib/twilio.ts` — Twilio-Client, Signatur-Validierung, TwiML-Helper
- `src/lib/auth.ts` — `requireAdmin()` Hilfsfunktion für Admin-Routen
- `src/lib/media-worker.ts` — Kernlogik des Medien-Download-Workers (wiederverwendbar)
- `src/app/api/webhooks/twilio/route.ts` — POST-Webhook (öffentlich, HMAC-gesichert)
- `src/app/api/admin/whatsapp/phone-registrations/route.ts` — GET + POST
- `src/app/api/admin/whatsapp/phone-registrations/[id]/route.ts` — DELETE
- `src/app/api/admin/whatsapp/messages/route.ts` — GET (letzte 100 Nachrichten)
- `src/app/api/admin/whatsapp/worker/route.ts` — POST (manueller Worker-Trigger)
- `scripts/media-worker.ts` — CLI-Worker (Polling alle 30 Sek., per systemd/Docker zu starten)
- `src/app/admin/whatsapp/page.tsx` — Admin-Seite (Server-Komponente, Auth-Check)
- `src/components/whatsapp/WebhookUrlCard.tsx` — Webhook-URL-Anzeige mit Kopieren-Button
- `src/components/whatsapp/WhatsAppNummernCard.tsx` — Tabelle + Hinzufügen/Löschen von Telefonnummern
- `src/components/whatsapp/TelefonnummerHinzufuegenDialog.tsx` — Dialog: Mitarbeiter + Nummer + Bezeichnung
- `src/components/whatsapp/WhatsAppNachrichtenCard.tsx` — Nachrichten-Log (letzte 100, mit Status-Badges)
- `src/components/layout/Navigation.tsx` — „WhatsApp"-Link für Admins ergänzt

### Tests
- 11 Unit-Tests (Vitest), alle grün
- Abdeckung: Signatur-Validierung, Idempotenz, bekannte/unbekannte Absender, Foto-Verarbeitung, Admin-Auth, Zod-Validierung, Duplikat-Schutz (409)

### Benötigte Umgebungsvariablen
```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WEBHOOK_URL=https://deine-domain.de/api/webhooks/twilio
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
MEDIA_UPLOAD_PATH=/var/uploads/whatsapp
```

### Abweichungen vom Design
- Keine: Implementierung entspricht dem Architektur-Design

## QA Test Results

---

### QA-Lauf 2 — 2026-04-28 (Re-QA nach Erweiterungen durch PROJ-9/10/11)

**QA-Datum:** 2026-04-28
**Tester:** QA Engineer (Code-Review + automatisierte Tests)
**Getestete Commits:** 760839a → 1d26a19 (Änderungen an route.ts, media-worker.ts, auth.ts, Admin-UI)

#### Automated Tests
```
Unit Tests (Vitest):  15 Dateien, 144 Tests — alle bestanden
Build (Next.js):       fehlerfrei
E2E (Playwright):      2 passed (Auth-Redirect), 24 skipped (kein Auth-Cookie im CI)
```

#### Acceptance Criteria

| # | Kriterium | Status | Anmerkung |
|---|-----------|--------|-----------|
| 1 | Webhook empfängt POST-Requests von Twilio | ✅ PASS | `POST /api/webhooks/twilio` — unverändert korrekt |
| 2 | Webhook-Signatur wird validiert (HMAC) | ✅ PASS | `validateTwilioSignature()` via offiziellem Twilio SDK; 403 bei Fehler |
| 3 | Text-, Audio- und Foto-Nachrichten unterstützt | ✅ PASS | `detectMessageType()` wertet `MediaContentType` aus |
| 4 | Medien-Dateien werden lokal gespeichert | ✅ PASS | Asynchron via `media_jobs`-Queue + Worker; Retry 3x |
| 5 | Absender-Nummer wird abgeglichen | ✅ PASS | E.164-Normalisierung + `phone_registrations`-Lookup |
| 6 | Unbekannte Absender erhalten Antwort | ✅ PASS | Korrekte TwiML-Antwort und Logging |
| 7 | Bekannte Absender erhalten Bestätigung | ⚠️ PARTIAL | Ohne [Projektkürzel] — Designabhängigkeit von PROJ-10 (BUG-3, Low) |
| 8 | Nachrichten werden in `incoming_messages` geloggt | ✅ PASS | Alle Felder vorhanden; erweitert um PROJ-10-Felder |
| 9 | Admin-UI: Nummern verwalten + Webhook-URL | ✅ PASS | `/admin/whatsapp` vollständig implementiert (alle Komponenten gebaut) |

#### Edge Cases

| Edge Case | Status | Anmerkung |
|-----------|--------|-----------|
| Twilio-Retry (Duplikat) | ✅ PASS | Idempotenz via `twilio_message_sid` UNIQUE |
| Medien-Download schlägt fehl | ✅ PASS | 3 Retry-Versuche; Status `failed` + `last_error` |
| Server nicht erreichbar | ✅ PASS | Twilio-seitige Wiederholung (11×/24h) |
| Speicher voll (ENOSPC) | ✅ PASS | Worker erkennt `ENOSPC`, sendet WhatsApp-Reply (BUG-1 behoben) |
| Gruppen-Nachrichten | ✅ PASS | Twilio Sandbox kein Gruppen-Support — kein Filtercode nötig |

#### Security Audit (Red Team)

| Angriffsvektor | Ergebnis | Detail |
|----------------|----------|--------|
| Gefälschter Webhook (ohne Signatur) | ✅ Sicher | `403 Forbidden` sofort zurückgegeben |
| Replay-Angriff (Duplikat-SID) | ✅ Sicher | Idempotenz-Check ignoriert bekannte SIDs |
| SQL-Injection | ✅ Sicher | Supabase parametrisierte Queries |
| Path Traversal beim Datei-Speichern | ✅ Sicher | Filename aus Twilio-SID (`SM` + 32 Hex-Zeichen) |
| Unbefugter Admin-Zugriff | ✅ Sicher | `requireAdmin()` liest Session aus HTTP-only Cookie; Rolle aus `nutzer_profile` |
| Service-Role-Leak | ✅ Sicher | `SUPABASE_SERVICE_ROLE_KEY` nur serverseitig |
| RLS deaktiviert | ✅ Sicher | Alle Tabellen (inkl. `assignment_jobs`) haben RLS |
| Secrets in API-Response | ✅ Sicher | Keine Auth-Token oder Twilio-SID in Responses |

#### Gefundene Bugs

##### BUG-1: Disk-Full → stummer Retry ✅ BEHOBEN
- **Fix:** `media-worker.ts` erkennt `ENOSPC` und sendet WhatsApp-Reply.

##### BUG-2: Race Condition im Worker bei mehreren Instanzen (offen)
- **Severity:** Medium
- **Beschreibung:** Worker liest `pending`-Jobs und setzt sie danach separat auf `processing` — zwei getrennte Queries. Zwei parallele Worker-Instanzen können denselben Job doppelt verarbeiten.
- **Reproduzieren:** Zwei simultane `POST /api/admin/whatsapp/worker`-Requests
- **Risiko:** Gering (Single-Server MVP), relevant bei Horizontal Scaling

##### BUG-3: Bestätigungs-Antwort ohne Projektkürzel (offen, by design)
- **Severity:** Low
- **Beschreibung:** Antwort lautet `"✓ Nachricht empfangen. Verarbeitung läuft..."` statt `"...für [Projektkürzel]..."`. Abhängig von PROJ-10.

##### BUG-4: Twilio Media-URL ohne Domain-Validierung (offen, akzeptiertes Risiko)
- **Severity:** Low
- **Beschreibung:** `twilio_media_url` wird ohne Prüfung auf `api.twilio.com` an `https.get()` übergeben. Risiko minimal (HMAC-validierte Quelle, service_role-Schreibschutz).

##### BUG-5: Produktionsmodus — falsche Tabelle für Projektkürzel-Lookup ✅ BEHOBEN
- **Severity:** Medium → Behoben
- **Fix:** DB-Query auf `assignment_jobs.project_id` entfernt (Spalte existiert nicht). Stattdessen wird mit `extractHashtags(body)` der erste Hashtag aus dem Nachrichtentext als Template-Variable `{1}` verwendet — ohne zusätzlichen DB-Roundtrip. Wenn kein Hashtag vorhanden, Fallback auf `'unbekannt'`.

##### BUG-6: React Fragment ohne key-Prop in WhatsAppNachrichtenCard (NEU)
- **Severity:** Low
- **Datei:** `src/components/whatsapp/WhatsAppNachrichtenCard.tsx:282`
- **Beschreibung:** In `.map()` wird ein nacktes `<>...</>` Fragment ohne `key`-Prop gerendert. React-Warning: "Each child in a list should have a unique key prop." Kann bei auf-/zugeklappten Audio-Zeilen zu fehlerhafter Reconciliation führen.
- **Fix:** `<>` ersetzen durch `<React.Fragment key={n.id}>`.

#### Produktionsreife-Entscheidung

**✅ APPROVED (Sandbox-Modus)**
Keine Critical- oder High-Bugs. Webhook, Signatur-Validierung, Idempotenz, Logging und Admin-UI sind vollständig implementiert.

**Offene Punkte:**
- BUG-2 (Medium, Race Condition) → Akzeptiertes Risiko für Single-Server MVP
- BUG-5 (Medium) → Betrifft nur Produktionsmodus (PROJ-11); für Sandbox nicht relevant
- BUG-6 (Low) → React-Warning, kein funktionaler Ausfall

#### E2E-Tests
- Datei: `tests/PROJ-8-whatsapp-integration.spec.ts` (14 Tests × 2 Browser = 28 Läufe)
- Auth-Redirect: **2 passed** (Chromium + Mobile Safari)
- Authenticated flows: **24 skipped** (kein Auth-Cookie ohne Live-Session)

---

### QA-Lauf 1 — 2026-04-22 (Erstabnahme)

**QA-Datum:** 2026-04-22
**Tester:** QA Engineer (automatisiert + Code-Review)
**Getestete Commit:** 760839a

#### Automated Tests
```
Test Files: 2 passed
Tests:      11 passed / 0 failed
Laufzeit:   644ms
```

#### Acceptance Criteria (Lauf 1)

| # | Kriterium | Status | Anmerkung |
|---|-----------|--------|-----------|
| 1–6, 8 | Backend-Kriterien | ✅ PASS | Vollständig implementiert |
| 7 | Bestätigung mit Projektkürzel | ⚠️ PARTIAL | Abhängig von PROJ-10 |
| 9 | Admin-UI | ⚠️ PARTIAL | Backend fertig; Frontend noch ausstehend |

#### Bugs (Lauf 1)
- BUG-1 (Medium): Disk-Full → kein WhatsApp-Reply → **behoben** während Lauf 1
- BUG-2 (Medium): Race Condition Worker → offen
- BUG-3 (Low): Projektkürzel fehlt → by design
- BUG-4 (Low): Media-URL ohne Domain-Check → akzeptiertes Risiko

## Deployment
_To be added by /deploy_
