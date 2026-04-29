# PROJ-11: WhatsApp Business API Migration

## Status: In Review
**Created:** 2026-04-21
**Last Updated:** 2026-04-23

## Dependencies
- Requires: PROJ-8 (WhatsApp-Integration Twilio Sandbox) — Sandbox muss vollständig funktionieren

## Beschreibung
Migration von der Twilio Sandbox-Integration (nur registrierte Testnummern) zur offiziellen WhatsApp Business API über einen zertifizierten Meta-Provider (z. B. Twilio, 360dialog, oder direkt Meta Cloud API). Ermöglicht unbegrenzte Kommunikation mit allen Mitarbeitern ohne vorherige Sandbox-Registrierung. Erfordert offizielle Meta-Genehmigung für eine WhatsApp Business Account Nummer.

## User Stories
- Als **Admin** möchte ich alle 10 Mitarbeiter ohne manuelle Sandbox-Registrierung nutzen können, damit der Onboarding-Aufwand minimal ist.
- Als **Mitarbeiter** möchte ich über eine offizielle, verifizierten Büro-Nummer kommunizieren, damit die Kommunikation professionell und vertrauenswürdig wirkt.
- Als **Admin** möchte ich die Migration ohne Datenverlust durchführen, damit alle bisherigen Begehungsdaten erhalten bleiben.

## Acceptance Criteria
- [ ] WhatsApp Business Account ist bei Meta verifiziert und genehmigt
- [ ] Offizielle Büro-Telefonnummer ist als WhatsApp Business Number registriert
- [ ] Webhook-URL zeigt weiterhin auf denselben Server-Endpunkt (nahtlose Migration)
- [ ] Alle Mitarbeiter können ohne Sandbox-Registrierung Nachrichten senden
- [ ] Bestehende Testnachrichten aus der Sandbox-Phase bleiben in der Datenbank erhalten
- [ ] Nachrichten-Templates sind bei Meta registriert (für ausgehende Bestätigungen)
- [ ] Admin-UI: Twilio-Konfiguration von Sandbox-Modus auf Produktions-Modus umschaltbar (kein Code-Deployment nötig)

## Edge Cases
- Was passiert, wenn Meta die Business Account-Genehmigung ablehnt? → Sandbox-Integration bleibt aktiv; Mitarbeiter werden manuell registriert.
- Was passiert während der Migration (Downtime)? → Migrationsfenster außerhalb der Bürozeiten planen; max. 30 Minuten Downtime akzeptabel.

## Technical Requirements
- WhatsApp Business API via Twilio (konservative Wahl) oder 360dialog
- Nachrichten-Templates für Bestätigungen müssen bei Meta vorab genehmigt werden
- Kosten: ~0,05 €/Nachricht für Business-Initiated Messages (ausgehend); eingehende Nachrichten günstiger
- Secrets-Management: API-Keys und Auth-Tokens aus Umgebungsvariablen (niemals im Code)

---

## Tech Design (Solution Architect)

### Kernaussage

PROJ-11 ist keine neue Funktion, sondern eine **Infrastruktur-Migration mit einer neuen Admin-Konfigurationsebene**. Alle bestehenden Komponenten aus PROJ-8 (Webhook, Worker, Admin-APIs, DB-Tabellen) bleiben unverändert — es ändern sich nur die Credentials, die Absender-Nummer und das Verhalten bei ausgehenden Nachrichten (Templates statt Freitext).

**Provider-Entscheidung:** Twilio (beibehalten) — kein SDK-Wechsel, gleiche Signatur-Validierung, gleiche Webhook-URL.

---

### Komponenten-Struktur

```
Admin-Bereich (/admin/whatsapp)  [bestehend aus PROJ-8]
├── Bestehend: Webhook-URL, Telefonnummern-Tabelle, Nachrichten-Log
└── NEU: Produktions-Konfiguration
    ├── BetriebsmodusToggle     "Sandbox" ↔ "Produktion"
    │                           Gespeichert in DB — kein Code-Deployment nötig
    ├── AktiveNummerAnzeige     Zeigt aktive WhatsApp-Nummer
    │                           (Sandbox-Nummer vs. verifizierte Büronummer)
    ├── Template-Status-Liste   Live-Abfrage der Meta-Templates via Twilio API
    │   ├── Spalten: Name, Kategorie, Genehmigungsstatus, letzte Prüfung
    │   └── Status-Badges: APPROVED / PENDING / REJECTED
    └── Migrations-Checkliste   Schritt-für-Schritt mit automatischen Prüfungen
        ├── [Auto] Produktions-Credentials gültig? (Twilio API-Test)
        ├── [Auto] Büronummer als WhatsApp Business Number registriert?
        ├── [Auto] Mind. 1 Template mit Status APPROVED vorhanden?
        ├── [Manuell] Meta Business Account verifiziert?
        └── [Manuell] Testlauf mit Mitarbeiter-Nummer erfolgreich?

Backend (neue Endpunkte, nur Admin)
├── GET  /api/admin/whatsapp/config       Liest aktuellen Modus + aktive Nummer
├── POST /api/admin/whatsapp/config       Speichert neuen Modus (sandbox | production)
└── GET  /api/admin/whatsapp/templates    Fragt Template-Status live von Twilio ab

Bestehender Webhook (UNVERÄNDERT)
└── POST /api/webhooks/twilio             Gleiche URL, gleiche HMAC-Signatur-Validierung
                                          Sendet je nach Modus Freitext oder Template
```

---

### Datenmodell

**`system_config`** — Systemweite Laufzeit-Konfiguration *(neue Tabelle)*

| Feld | Typ | Beispielwert |
|---|---|---|
| `key` | TEXT (Primary Key) | `whatsapp_mode` |
| `value` | TEXT | `sandbox` \| `production` |
| `updated_by` | FK → users | UUID |
| `updated_at` | TIMESTAMP | 2026-04-22T10:00:00Z |

**Relevante Konfigurationsschlüssel:**

| Key | Zweck |
|---|---|
| `whatsapp_mode` | Aktiver Betriebsmodus (`sandbox` \| `production`) |
| `whatsapp_active_number` | Aktuell aktive Absender-Nummer (E.164) |
| `whatsapp_template_sid_bestaetigung` | Template-SID für Eingangsbestätigung |
| `whatsapp_template_sid_unbekannt` | Template-SID für unbekannte Absender |

> Alle anderen Tabellen (phone\_registrations, incoming\_messages, media\_jobs) bleiben **unverändert**. Keine Datenmigration nötig.

---

### Nachrichten-Templates (Meta-Pflicht im Produktions-Modus)

| Template-Name | Inhalt | Kategorie |
|---|---|---|
| `eingangsbestaetigung` | „✓ Nachricht empfangen für {{1}}. Verarbeitung läuft..." | UTILITY |
| `unbekannte_nummer` | „Ihre Nummer ist nicht registriert. Bitte wenden Sie sich an Ihren Administrator." | UTILITY |

Templates werden **einmalig manuell** im Twilio-Console registriert und von Meta genehmigt (Dauer: 1–5 Werktage). Die SIDs werden anschließend in `system_config` hinterlegt.

---

### Laufzeitverhalten: Modus-Unterschiede

| Aspekt | Sandbox-Modus | Produktions-Modus |
|---|---|---|
| Absender-Nummer | Twilio Sandbox-Nummer | Verifizierte Büronummer |
| Empfänger | Nur vorab registrierte Testnummern | Alle Mitarbeiter ohne Einschränkung |
| Ausgehende Nachrichten | Freitext (Sandbox erlaubt das) | Meta-genehmigte Templates (Pflicht) |
| Kosten | Kostenlos | ~0,05 €/Nachricht (Business-Initiated) |

---

### Automatische Prüfungen in der Migrations-Checkliste

| Prüfung | Methode | Ergebnis |
|---|---|---|
| Credentials gültig | Twilio API: `GET /Accounts/{SID}` | HTTP 200 = gültig |
| Büronummer registriert | Twilio API: `GET /IncomingPhoneNumbers` | Nummer in Liste = registriert |
| Template APPROVED | Twilio API: `GET /Content/v1/ContentAndApprovals` | Status = APPROVED |

Alle drei Prüfungen laufen beim Öffnen der Konfigurationsseite und können manuell neu ausgelöst werden (Refresh-Button). Ergebnisse werden **nicht gecacht** — immer Live-Abfrage, damit der Admin den echten Zustand sieht.

---

### Technische Entscheidungen

| Entscheidung | Gewählt | Begründung |
|---|---|---|
| Provider | Twilio (beibehalten) | Kein SDK-Wechsel, gleiche Webhook-URL, minimales Migrationsrisiko |
| Modus-Speicherung | DB (`system_config`) statt Env-Variable | Umschalten zur Laufzeit ohne Deployment — Acceptance Criterion |
| Webhook-URL | Unverändert (`/api/webhooks/twilio`) | Nahtlose Migration, kein Twilio-Konfigurationswechsel nötig |
| Template-Referenz | Template-SID in `system_config` | Kein Hardcoding; SIDs können im Admin ohne Code-Änderung gesetzt werden |
| Checklisten-Prüfungen | Live-Abfrage via Twilio API | Admin ohne Console-Zugriff sieht den echten Genehmigungsstatus |
| Migrations-Downtime | Max. 30 Min., außerhalb Bürozeiten | Laut Spec akzeptabler Rahmen; Credentials-Swap dauert < 5 Min. |

### Neue Umgebungsvariablen

```
# Produktions-Credentials (zusätzlich zu den bestehenden Sandbox-Vars)
TWILIO_PRODUCTION_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PRODUCTION_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PRODUCTION_PHONE_NUMBER=+4989123456
```

### Abhängigkeiten (keine neuen Pakete)

Das Twilio SDK (`twilio`) ist bereits vorhanden. Template-Aufrufe und API-Prüfungen erfolgen über dieselbe SDK-Instanz.

### Abgrenzung (nicht in PROJ-11)

- Alternativer Provider (360dialog, Meta Cloud API direkt) — bewusst ausgeschlossen
- Automatische Template-Registrierung via API — manuell über Twilio Console (einmalig)
- Kosten-Monitoring oder Abrechnungs-Dashboard — Out of Scope

## Implementation Notes

### Was gebaut wurde
- **Supabase-Migration** `20260423_proj11_system_config.sql`: Neue `system_config`-Tabelle mit RLS; Standard-Werte für `whatsapp_mode` (sandbox), `whatsapp_active_number`, und beide Template-SIDs.
- **API: GET/POST `/api/admin/whatsapp/config`**: Liest und schreibt Laufzeit-Konfiguration ohne Code-Deployment. Zod-validiert.
- **API: GET `/api/admin/whatsapp/templates`**: Live-Abfrage der Meta-Template-Status via Twilio Content API v1.
- **API: GET `/api/admin/whatsapp/migration-checks`**: Drei automatische Prüfungen (Credentials, Telefonnummer, Template-Approval) via Twilio REST API.
- **Webhook `/api/webhooks/twilio`**: Liest `whatsapp_mode` aus DB; sendet im Produktions-Modus via Twilio Content API (Template), fällt auf Freitext zurück wenn kein Template-SID konfiguriert.
- **Frontend `BetriebsmodusCard`**: Toggle Sandbox ↔ Produktion + Felder für aktive Nummer und Template-SIDs.
- **Frontend `TemplateStatusCard`**: Tabellarische Anzeige aller Twilio-Templates mit APPROVED/PENDING/REJECTED-Badges.
- **Frontend `MigrationsChecklisteCard`**: Auto-Prüfungen + manuelle Checkboxen (Meta-Verifizierung, Testlauf).
- **Admin-Page**: Neuer Abschnitt „Business API Migration" mit allen drei Karten.
- **`.env.local.example`**: Produktions-Credentials dokumentiert.

### Abweichungen vom Tech Design
- Keine. Alle Komponenten aus dem Architecture-Doc umgesetzt.

## QA Test Results

**QA-Datum:** 2026-04-29
**Tester:** /qa (Claude)
**Status:** ❌ NOT READY — 1 Critical Bug

### Automated Tests
- **Vitest Unit/Integration:** 225 passed (197 existing + 28 neue PROJ-11-Tests) — keine Regressionen
- **Playwright E2E:** 2 passed, 38 skipped (server-seitige Auth-Weiterleitung ohne echte Supabase-Session — konsistent mit PROJ-8/9/10)
- **Neue Unit-Test-Files:**
  - `src/app/api/admin/whatsapp/config/route.test.ts` — 10 Tests (GET + POST)
  - `src/app/api/admin/whatsapp/templates/route.test.ts` — 6 Tests
  - `src/app/api/admin/whatsapp/migration-checks/route.test.ts` — 7 Tests
  - `src/app/api/webhooks/twilio/route.test.ts` — 3 neue Tests für Produktions-Modus
- **E2E-Test-File:** `tests/PROJ-11-whatsapp-business-api.spec.ts` — 20 Tests (AC-AUTH, AC-2 bis AC-7)

### Acceptance Criteria

| # | Kriterium | Status | Notiz |
|---|-----------|--------|-------|
| AC-1 | WhatsApp Business Account bei Meta verifiziert | N/A | Erfordert echten Meta-Account; Admin-Checkliste vorhanden |
| AC-2 | Offizielle Büronummer als WA Business Number registriert | N/A | Migrations-Checkliste prüft automatisch via Twilio API |
| AC-3 | Webhook-URL unverändert (`/api/webhooks/twilio`) | ✅ PASS | Route unverändert; WebhookUrlCard weiterhin sichtbar |
| AC-4 | Alle Mitarbeiter ohne Sandbox-Registrierung erreichbar | N/A | Produktions-Modus-Logik korrekt implementiert |
| AC-5 | Bestehende Sandbox-Daten bleiben erhalten | ✅ PASS | SQL-Migration nur additive (`system_config`-Tabelle); keine Datenmigration |
| AC-6 | Nachrichten-Templates bei Meta registriert | N/A | TemplateStatusCard und Template-SID-Felder implementiert |
| AC-7 | Modus-Umschaltung ohne Code-Deployment (DB-gespeichert) | ✅ PASS | Toggle schreibt in `system_config` via POST /api/admin/whatsapp/config |

### Bugs Found

#### 🔴 CRITICAL

**BUG-1: Echte Twilio-Credentials in `.env.local.example`**
- **Beschreibung:** Die aktuell nicht committete Version von `.env.local.example` enthält echte Produktions-Credentials (`TWILIO_PRODUCTION_ACCOUNT_SID=ACdabf8c...`, `TWILIO_PRODUCTION_AUTH_TOKEN=222d7e...`) statt Platzhalter. Im Git-Stand sind Platzhalter (`ACxxxxxx`). Die Working-Tree-Änderung muss zurückgesetzt werden.
- **Auswirkung:** Bei versehentlichem `git add .env.local.example` werden echte Credentials ins Repository committed und öffentlich zugänglich.
- **Reproduktion:** `git diff .env.local.example` zeigt echte Werte statt `ACxxxxxxxx`.
- **Priorität:** Sofort beheben vor jedem `git add`

#### 🟡 MEDIUM

**BUG-2: Keine E.164-Format-Validierung für `whatsapp_active_number`**
- **Beschreibung:** POST `/api/admin/whatsapp/config` akzeptiert beliebigen String für `whatsapp_active_number`. Kein Regex-Check auf E.164-Format (`\+[1-9]\d{7,14}`).
- **Auswirkung:** Ungültige Nummer wird in DB gespeichert; Twilio-Nachrichten im Produktions-Modus schlagen lautlos fehl.
- **Fix:** Zod-Schema um `.regex(/^\+[1-9]\d{7,14}$/)` ergänzen.

**BUG-3: Keine Format-Validierung für Template-SIDs**
- **Beschreibung:** Template-SID-Felder akzeptieren beliebige Strings. Twilio Content SIDs haben Format `HX[a-z0-9]{32}` (34 Zeichen). Ungültige SIDs führen zu stillen Template-Fehlern im Produktions-Modus.
- **Fix:** Zod-Schema um `.regex(/^HX[a-z0-9]{32}$/).optional()` ergänzen.

**BUG-4: Fehlende `.limit()` auf `system_config`-Query (Backend-Regel-Verletzung)**
- **Beschreibung:** In `GET /api/admin/whatsapp/config` fehlt `.limit()` auf der `system_config`-Abfrage. Verletzt die Backend-Konvention "Use `.limit()` on all list queries".
- **Fix:** `.in('key', CONFIG_KEYS).limit(10)` verwenden.

#### 🔵 LOW

**BUG-5: Kein Bestätigungsdialog beim Wechsel in Produktions-Modus**
- **Beschreibung:** Der Modus-Toggle wechselt sofort von Sandbox → Produktion ohne Rückfrage. Ein Missklick aktiviert den Produktions-Modus für alle eingehenden Nachrichten.
- **Fix:** AlertDialog-Komponente vor dem POST-Request anzeigen ("Wirklich in Produktions-Modus wechseln?").

**BUG-6: Manuelle Checklisten-Checkboxen werden bei Seitenreload zurückgesetzt**
- **Beschreibung:** "Meta Business Account verifiziert" und "Testlauf erfolgreich" sind rein client-seitig. Nach Seitenreload sind beide zurückgesetzt und das "Bereit für Produktion"-Badge verschwindet, obwohl die Schritte erledigt wurden.
- **Fix:** Checkbox-Zustand in `system_config` persistieren (zwei neue Keys) oder `localStorage` verwenden.

**BUG-7: `vi.mock('twilio')` nested in Test-Funktion — Hoisting-Warnung**
- **Beschreibung:** In `src/app/api/webhooks/twilio/route.test.ts` wird `vi.mock('twilio')` innerhalb einer `it()`-Funktion aufgerufen. Vitest warnt, dass dies in zukünftigen Versionen ein Fehler sein wird.
- **Fix:** Mock an die oberste Ebene des Test-Files verschieben (vor den `describe`-Block).

### Security Audit

| Bereich | Befund | Status |
|---------|--------|--------|
| Authentifizierung | Alle 3 neuen Routen verwenden `requireAdmin()` | ✅ |
| Autorisierung | Nur Admins können Konfiguration lesen/schreiben | ✅ |
| Hardcoded Secrets im Code | Keine — nur `process.env.*`-Zugriffe | ✅ |
| Secrets in `.env.local.example` | **Echte Credentials in Working Tree** | ❌ BUG-1 |
| RLS auf `system_config` | Admin-Read + Service-Role-Full — korrekt | ✅ |
| Input-Validierung | Zod auf POST /config — aber ohne Phone/SID-Format | ⚠️ BUG-2/3 |
| SQL-Injection | Supabase parametrierte Queries | ✅ |
| SSRF | Twilio-URLs sind hardcodiert, nicht user-input | ✅ |
| Twilio Webhook HMAC | Unverändert — gleiche Signatur-Validierung | ✅ |

### Cross-Browser / Responsive
Nicht manuell testbar ohne echte Supabase-Session. E2E-Tests decken Auth-Redirect für Chromium und Mobile Safari ab.

### Regression Check
- Alle 197 existierenden Tests weiterhin grün ✅
- PROJ-8 Webhook-Route: Sandbox-Modus-Verhalten unverändert ✅
- PROJ-9/10 Admin-UI-Komponenten: Weiterhin auf der Seite vorhanden ✅

## Deployment
_To be added by /deploy_
