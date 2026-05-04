# PROJ-2: Projektverwaltung

## Status: Deployed
**Created:** 2026-04-21
**Last Updated:** 2026-04-30 (Bug-Fixes)

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — nur eingeloggte Admins können Projekte anlegen/verwalten

## Beschreibung
Admins legen Bauprojekte im System an und pflegen Stammdaten (Projektname, -nummer, Auftraggeber, Adresse, Laufzeit). Mitarbeiter werden einem oder mehreren Projekten zugeordnet. Das Projektkürzel (z. B. `BV-23-Hamburg`) dient später als Hashtag zur automatischen Zuordnung von WhatsApp-Nachrichten.

## User Stories
- Als **Admin** möchte ich ein neues Projekt mit Name, Nummer und Kürzel anlegen, damit Mitarbeiter Nachrichten korrekt zuordnen können.
- Als **Admin** möchte ich Mitarbeiter einem Projekt zuordnen, damit die Berechtigungen und Zuordnungen klar definiert sind.
- Als **Admin** möchte ich Projekte archivieren (nicht löschen), damit vergangene Projekte noch einsehbar sind.
- Als **Mitarbeiter** möchte ich eine Liste meiner zugeordneten Projekte sehen, damit ich schnell das richtige Projekt für eine Begehung auswählen kann.
- Als **Admin** möchte ich Projektdetails bearbeiten können, damit Änderungen (z. B. neue Adresse) aktuell bleiben.

## Acceptance Criteria
- [ ] Projekt-Anlage-Formular mit Pflichtfeldern: Projektname, Projektnummer, Projektkürzel (eindeutig, z. B. `BV-23-Hamburg`)
- [ ] Optionale Felder: Auftraggeber, Bauherr, Projektadresse, geplantes Startdatum, geplantes Enddatum, Beschreibung
- [ ] Projektkürzel ist eindeutig im System — Doppelungen werden beim Speichern verhindert
- [ ] Mitarbeiterzuordnung: Admin kann einem Projekt beliebig viele Mitarbeiter zuordnen/entfernen
- [ ] Projektliste mit Suchfunktion (nach Name, Nummer, Kürzel) und Filter (aktiv/archiviert)
- [ ] Projektdetailseite zeigt alle Stammdaten + zugeordnete Mitarbeiter + Anzahl Begehungsberichte
- [ ] Projekt archivieren: Status wechselt zu „Archiviert"; Daten bleiben erhalten; keine neuen Begehungen mehr möglich
- [ ] Archivierte Projekte sind in der Standardansicht ausgeblendet, aber über Filter sichtbar
- [ ] Mitarbeiter sehen nur ihre zugeordneten Projekte; Admins sehen alle Projekte

## Edge Cases
- Was passiert, wenn ein Projekt mit bestehenden Berichten archiviert wird? → Archivierung möglich; bestehende Berichte bleiben lesbar, aber neue Begehungen können nicht gestartet werden.
- Was passiert, wenn ein Mitarbeiter aus einem Projekt entfernt wird, dem bereits Berichte zugeordnet sind? → Entfernung ist möglich; die historischen Berichte bleiben dem Projekt erhalten.
- Was passiert, wenn zwei Admins gleichzeitig dasselbe Projekt bearbeiten? → Letzter Speichervorgang gewinnt; kein Echtzeit-Locking erforderlich (MVP).
- Was passiert, wenn ein Projekt-Kürzel geändert wird? → Bestehende Berichte bleiben dem Projekt zugeordnet; neue WhatsApp-Nachrichten müssen das neue Kürzel verwenden.
- Was passiert, wenn ein Mitarbeiter versucht, ein nicht-zugeordnetes Projekt aufzurufen? → 403-Fehler oder Redirect zur Projektliste.

## Technical Requirements
- Projektkürzel: Alphanumerisch, Bindestriche erlaubt, max. 20 Zeichen, case-insensitive Vergleich
- Soft-Delete für Projekte (archivieren statt löschen, `archived_at`-Timestamp)
- API-Endpunkte: GET /projects, POST /projects, PUT /projects/:id, PATCH /projects/:id/archive
- Rollenbasierter Zugriff: Schreibzugriff nur für Admins, Lesezugriff für Mitarbeiter (nur eigene Projekte)

---

## Tech Design (Solution Architect)

### Komponentenstruktur

```
Next.js App
+-- /admin/projekte  (Admin-only, Server-Komponente)
|   +-- ProjektlisteCard (Client)
|       +-- Suche (shadcn/ui Input + Search-Icon)
|       +-- Archiviert-Toggle (shadcn/ui Switch)
|       +-- Projekttabelle (shadcn/ui Table) — klickbare Zeilen
|       +-- NeueProjektDialog (shadcn/ui Dialog + react-hook-form)
|
+-- /admin/projekte/[id]  (Admin-only, Server-Komponente)
|   +-- ProjektBearbeitenForm (Client, shadcn/ui Card + Form)
|   |   +-- Felder: Name, Nummer, Kürzel, Auftraggeber, Bauherr, Adresse, Datum, Beschreibung
|   |   +-- ProjektArchiviereDialog (shadcn/ui AlertDialog)
|   +-- ProjektMitarbeiterCard (Client, shadcn/ui Card + Table)
|       +-- Mitarbeiterliste mit Entfernen-Button
|       +-- Hinzufügen-Dialog (shadcn/ui Dialog + Select)
|
+-- /projekte  (Alle Mitarbeiter, Client-Komponente)
    +-- Projektkarten-Liste
    +-- Suche + Archiviert-Toggle
```

### Datenmodell

**Tabelle `projekte`**
- id (uuid PK), name, nummer, kuerzel (unique, max 20 Zeichen, uppercase), auftraggeber, bauherr, adresse, start_datum, end_datum, beschreibung
- archived_at (null = aktiv, Timestamp = archiviert) — Soft-Delete
- erstellt_am, aktualisiert_am (auto via Trigger)

**Tabelle `projekt_mitarbeiter`**
- (projekt_id, nutzer_id) — Composite PK
- Referenziert projekte + nutzer_profile mit ON DELETE CASCADE

### API-Routen

| Route | Methode | Berechtigung |
|---|---|---|
| `/api/admin/projekte` | GET, POST | Admin |
| `/api/admin/projekte/[id]` | GET, PUT | Admin |
| `/api/admin/projekte/[id]/archivieren` | PATCH | Admin |
| `/api/admin/projekte/[id]/mitarbeiter` | GET, POST | Admin |
| `/api/admin/projekte/[id]/mitarbeiter/[nutzerId]` | DELETE | Admin |
| `/api/projekte` | GET | Alle eingeloggten Nutzer |

### RLS-Policies
- Admins sehen und bearbeiten alle Projekte.
- Mitarbeiter sehen nur Projekte, in denen sie in `projekt_mitarbeiter` eingetragen sind (keine Schreibrechte über RLS; alle Mutationen laufen über Service-Role in Admin-API-Routen).

## Implementation Notes (Frontend)

**Erstellt 2026-04-22:**
- DB-Migration `supabase/migrations/002_projekte.sql`: Tabellen `projekte` + `projekt_mitarbeiter`, Indexes, Update-Trigger, RLS-Policies, Hilfsfunktion `auth_rolle()`.
- API-Routen:
  - `GET/POST /api/admin/projekte` — Liste mit `?archiviert=true/false`, Anlage mit case-insensitiver Kürzel-Eindeutigkeitsprüfung.
  - `GET/PUT /api/admin/projekte/[id]` — Detail inkl. angereicherte Mitarbeiterliste.
  - `PATCH /api/admin/projekte/[id]/archivieren` — Setzt `archived_at`.
  - `GET/POST /api/admin/projekte/[id]/mitarbeiter` — Mitarbeiterliste mit E-Mails; Zuordnung hinzufügen.
  - `DELETE /api/admin/projekte/[id]/mitarbeiter/[nutzerId]` — Zuordnung entfernen.
  - `GET /api/projekte` — Für alle eingeloggten Nutzer; Admin sieht alle, Mitarbeiter nur eigene.
- Komponenten unter `src/components/projekte/`:
  - `types.ts` — Gemeinsame TypeScript-Typen.
  - `ProjektlisteCard.tsx` — Tabelle mit Client-seitiger Suche, Archiviert-Toggle, klickbare Zeilen, NeueProjektDialog.
  - `NeueProjektDialog.tsx` — Formular (shadcn/ui Dialog + react-hook-form + Zod) für alle Felder; Kürzel wird automatisch uppercase formatiert.
  - `ProjektArchiviereDialog.tsx` — shadcn/ui AlertDialog mit destruktiver Bestätigung.
  - `ProjektBearbeitenForm.tsx` — Card-Formular; bei archivierten Projekten read-only; Archivieren-Button.
  - `ProjektMitarbeiterCard.tsx` — Tabelle + Hinzufügen-Dialog (Select aus Nutzerliste); Entfernen mit Bestätigung via Toast.
- Seiten:
  - `src/app/admin/projekte/page.tsx` — Admin-only mit Session-Check und Rolle-Guard.
  - `src/app/admin/projekte/[id]/page.tsx` — Detail + generateMetadata für Seitentitel.
  - `src/app/projekte/page.tsx` — Client-Seite für Mitarbeiter (read-only Karten-Layout).
- Alle Texte Deutsch, shadcn/ui-Komponenten durchgängig, Lade-/Fehler-/Leer-Zustände in allen Client-Komponenten.

## QA Test Results

### Re-Test 2026-04-30

**Getestet am:** 2026-04-30
**QA-Methode:** Code-Review aller Implementierungsdateien + Unit-Tests (`npm test`: 295/295) + E2E-Tests Playwright (42/42 neu, beide Browser: Chromium + Mobile Safari)
**Tester:** QA Engineer

#### Bug-Status-Update

| Bug | Severity | Status (2026-04-30) | Notiz |
|-----|----------|---------------------|-------|
| BUG-001 | Medium | **BEHOBEN** ✅ | `src/app/admin/projekte/[id]/page.tsx`: Supabase-Count-Query auf `begehungen WHERE projekt_id = id`; Anzeige mit Icon im Seiten-Header. |
| BUG-002 | High | **BEHOBEN** ✅ | `src/app/api/begehungen/route.ts` Z. 118–133: `archived_at`-Check bestätigt. Gibt 422 zurück. |
| BUG-003 | Low | **BEHOBEN** ✅ | `src/middleware.ts`: Redirect für Nicht-Admin-Nutzer von `/` auf `/projekte` geändert. |
| BUG-004 | Low | **BEHOBEN** ✅ | `src/middleware.ts`: `checkRateLimitMutation()` (30 req/min) für alle POST/PUT/PATCH/DELETE auf `/api/admin/projekte`. |
| BUG-005 | Low | **BEHOBEN** ✅ | `src/app/api/admin/projekte/[id]/route.ts` PUT: Prüft `archived_at` vor Update; gibt 409 zurück wenn archiviert. |
| BUG-006 | Low | **OFFEN** (akzeptiert) | `.limit(500)` in List-Endpunkten; Pagination erst bei Wachstum > 500 Projekte relevant. |
| BUG-007 | Low | **BEHOBEN** ✅ | `src/components/projekte/ProjektlisteCard.tsx`: Neue Spalte „Team" mit `Users`-Icon und `mitarbeiter_anzahl`. |

#### Neue E2E-Tests

`tests/PROJ-2-projektverwaltung.spec.ts` — 21 Tests (42 Ausführungen über Chromium + Mobile Safari):
- AC#1–9: Auth-Schutz und Redirect-Verhalten aller Endpunkte
- Sicherheits-Tests: IDOR, Mass-Assignment, XSS im Kürzel
- Regressions-Test BUG-002: `POST /api/begehungen` auf archiviertes Projekt

**Produktionsreife-Entscheidung: READY** — Keine neuen Critical/High-Bugs. Status bleibt **Approved**.

---

### Erst-Test 2026-04-24

**Getestet am:** 2026-04-24
**QA-Methode:** Statische Code-Analyse + Unit/Integrations-Tests (`npm test`: 27/27 bestanden) + manuelle API-Trace-Verifikation
**Tester:** QA Engineer

---

### Acceptance Criteria

| # | Kriterium | Status | Notiz |
|---|-----------|--------|-------|
| 1 | Anlage-Formular mit Pflichtfeldern Name, Nummer, Kürzel | PASS | `NeueProjektDialog.tsx` Zod-Schema fordert `min(1)` für `name`, `nummer`, `kuerzel`; gleiche Validierung server-seitig in `route.ts`. |
| 2 | Optionale Felder (Auftraggeber, Bauherr, Adresse, Start/End-Datum, Beschreibung) | PASS | Alle sechs Felder im Dialog vorhanden; Server akzeptiert `optional().nullable()`. Empty Strings werden client-seitig zu `null` konvertiert. |
| 3 | Projektkürzel eindeutig (case-insensitive) | PASS | `POST /api/admin/projekte` führt `ilike` Lookup vor Insert durch (Zeile 90–101); `PUT /api/admin/projekte/[id]` ebenso (Zeile 111–125). DB-Constraint `projekte_kuerzel_unique` als zweite Schicht. Kürzel wird vor Insert auf UPPERCASE normiert. |
| 4 | Mitarbeiterzuordnung (beliebig viele hinzufügen/entfernen) | PASS | `POST /api/admin/projekte/[id]/mitarbeiter` + `DELETE .../mitarbeiter/[nutzerId]`; `ProjektMitarbeiterCard` mit Hinzufügen-Dialog und Entfernen-Button; behandelt UNIQUE-Verletzung (23505) als 409. |
| 5 | Projektliste mit Suche + Filter aktiv/archiviert | PASS | `ProjektlisteCard.tsx`: client-seitige Suche über `name`/`nummer`/`kuerzel` (`useMemo`); Switch-Toggle steuert `?archiviert=true`. |
| 6 | Detailseite zeigt Stammdaten + Mitarbeiter + Anzahl Begehungsberichte | PARTIAL | `admin/projekte/[id]/page.tsx` zeigt Stammdaten und Mitarbeiterliste; **die Anzahl Begehungsberichte wird nirgends angezeigt** — siehe BUG-001. |
| 7 | Archivieren: Status wechselt; Daten bleiben; keine neuen Begehungen | PASS | `PATCH /api/admin/projekte/[id]/archivieren` setzt `archived_at` korrekt; UI zeigt "Archiviert"-Badge. `POST /api/begehungen` prüft jetzt `archived_at` und gibt 422 zurück wenn archiviert (BUG-002 behoben). |
| 8 | Archivierte Projekte standardmäßig ausgeblendet, per Filter sichtbar | PASS | API-Default `?archiviert=false` filtert auf `archived_at IS NULL`; Toggle setzt `?archiviert=true`. |
| 9 | Mitarbeiter sehen nur zugeordnete Projekte; Admins alle | PASS | `GET /api/projekte`: Admin-Branch holt alle, Mitarbeiter-Branch joined `projekt_mitarbeiter`; RLS in `002_projekte.sql` als zweite Schicht (`projekte_select_admin` / `projekte_select_mitarbeiter`). Test deckt beide Pfade ab. |

**Ergebnis: 7/9 Criteria voll bestanden, 2 mit Einschränkungen**

---

### Edge Cases

| Edge Case | Status | Notiz |
|-----------|--------|-------|
| Projekt mit bestehenden Berichten archivieren | PASS | Archivierung funktioniert; `POST /api/begehungen` verhindert nun neue Begehungen auf archiviertem Projekt (BUG-002 behoben). |
| Mitarbeiter aus Projekt entfernen, dem Berichte zugeordnet sind | PASS | `DELETE /api/admin/projekte/[id]/mitarbeiter/[nutzerId]` löscht nur `projekt_mitarbeiter`-Eintrag; Begehungen bleiben dem Projekt erhalten (FK auf `projekte`, nicht auf `projekt_mitarbeiter`). |
| Zwei Admins editieren gleichzeitig | PASS (per Spec) | Last-Write-Wins, kein Locking; entspricht MVP-Vereinbarung. |
| Kürzel ändern | PASS | `PUT` Endpunkt erlaubt Kürzel-Änderung mit erneuter Eindeutigkeitsprüfung; bestehende `begehungen` referenzieren `projekt_id` (UUID), nicht das Kürzel — bleiben also korrekt zugeordnet. |
| Mitarbeiter ruft nicht-zugeordnetes Projekt auf | PARTIAL | `/api/projekte` liefert nur erlaubte Projekte (kein Direct-ID-Endpunkt für Mitarbeiter). **Aber: `/admin/projekte/[id]` wird durch Middleware blockiert (Redirect zu `/`)**, kein 403 für Direkt-ID-API. Akzeptabel, aber siehe BUG-003 für UX. |

---

### Security Audit (Red-Team)

| Prüfpunkt | Status | Details |
|-----------|--------|---------|
| Authentifizierung auf allen Admin-Routen | PASS | `requireAdmin()` als erste Zeile in jeder Route-Handler-Funktion (`/api/admin/projekte`, `/[id]`, `/[id]/archivieren`, `/[id]/mitarbeiter`, `/[id]/mitarbeiter/[nutzerId]`). Middleware setzt zweite Schicht. |
| Mitarbeiter-Endpunkt `/api/projekte` (Lesezugriff) | PASS | Verwendet `requireAuth()`, prüft `auth.role` und scoped die Query auf `projekt_mitarbeiter.nutzer_id = auth.userId`. |
| Input-Validierung mit Zod | PASS | Alle POST/PUT-Bodies via `safeParse`; Kürzel-Regex `^[A-Za-z0-9-]+$` blockiert XSS-Vektoren im Hashtag. Längen-Limits (200/50/20/2000) verhindern DoS. |
| SQL Injection | PASS | Supabase parametrisiert intern; kein Raw SQL. `ilike(parsed.data.kuerzel, ...)` ist ebenfalls parameterized. |
| RLS-Policies | PASS | Migration aktiviert RLS auf beiden Tabellen mit getrennten Policies für Admin/Mitarbeiter. Hilfsfunktion `auth_rolle()` ist `SECURITY DEFINER STABLE`. |
| IDOR (Insecure Direct Object Reference) auf `/api/admin/projekte/[id]` | PASS | Middleware + `requireAdmin()` blockieren Mitarbeiter komplett von `/api/admin/*`. Mitarbeiter können also nicht via ID-Manipulation auf fremde Projektdetails zugreifen. |
| Mass-Assignment | PASS | `updateSchema` in `[id]/route.ts` whitelistet nur erlaubte Felder; `archived_at`, `id`, `erstellt_am` können über PUT nicht überschrieben werden. |
| 403 vs. 404 (Information Disclosure) | NEUTRAL | `requireAdmin()` liefert 403; nicht-existente IDs liefern 404. Konsistent mit bestehender Codebase. |
| Service-Role-Client-Leakage | PASS | `createServiceClient()` wird nur server-seitig importiert; keine Verwendung in Client-Komponenten. |
| Kürzel als Hashtag (CSRF-relevant?) | PASS | Kürzel wird nicht ungeprüft in HTML gerendert; `<code>` mit Textinhalt; React escaped automatisch. Regex-Constraint verhindert HTML-Spezialzeichen. |
| Rate Limiting auf Projekt-Mutationen | FAIL | `middleware.ts` rate-limited nur `/api/auth/*` und `/login`. **Keine Limits auf Projekt-Erstellung** — ein kompromittierter Admin-Token kann tausende Projekte anlegen. Siehe BUG-004. |
| Security Headers (X-Frame-Options etc.) | FAIL | Middleware setzt keine HTTP-Security-Header — bekannt aus PROJ-1 BUG-003, gilt projektweit. |
| Audit Logging (wer hat archiviert?) | NEUTRAL | Keine Audit-Tabelle; `aktualisiert_am` zeigt nur den Zeitpunkt, nicht den User. Nicht in Spec gefordert; für DSGVO ggf. nachzubessern. |
| Session-Cookies (HTTP-Only, SameSite) | PASS | via `@supabase/ssr` (siehe PROJ-1). |
| Secrets in Code | PASS | Alle Credentials via `process.env` in `supabase-service.ts`. |

---

### Gefundene Bugs

#### BUG-001: AC#6 — Anzahl Begehungsberichte fehlt auf Detailseite
- **Severity:** Medium
- **Acceptance Criterion:** #6 ("Detailseite zeigt … Anzahl Begehungsberichte")
- **Beschreibung:** Die Detailseite `/admin/projekte/[id]` zeigt Stammdaten und das Team, aber keine Anzahl der zugehörigen Begehungsberichte. Die Anzahl wird weder im Server-Render noch über einen API-Aufruf geladen. In `ProjektlisteCard.tsx` wird ebenfalls keine `mitarbeiter_anzahl`-/Berichte-Spalte angezeigt, obwohl die API `mitarbeiter_anzahl` zurückliefert.
- **Steps to Reproduce:**
  1. Login als Admin, Projekt mit zugehörigen Begehungen aufrufen (`/admin/projekte/<id>`)
  2. Beobachte: keine Zahl/Badge mit Bericht-Anzahl sichtbar
- **Expected:** Eine Anzeige der Begehungs- bzw. Berichts-Anzahl (z. B. Badge "12 Berichte")
- **Actual:** Information fehlt komplett im UI
- **Datei:** `src/app/admin/projekte/[id]/page.tsx`, ggf. Erweiterung in `src/app/api/admin/projekte/[id]/route.ts`
- **Fix-Vorschlag:** In der GET-Detail-API ein `count` der `begehungen` mit `projekt_id = id` mitführen und im Header der Detailseite anzeigen.

#### BUG-002: AC#7 — Archivierte Projekte erlauben weiterhin neue Begehungen ✅ BEHOBEN
- **Severity:** High
- **Acceptance Criterion:** #7 ("keine neuen Begehungen mehr möglich")
- **Beschreibung:** `POST /api/begehungen` prüft `archived_at` nicht. Ein Mitarbeiter (oder Admin), dem ein archiviertes Projekt zugewiesen ist, kann weiterhin Begehungen anlegen und damit den fachlichen Zweck der Archivierung umgehen. Selbst ein PRD-Constraint ("vergangene Projekte noch einsehbar, aber nicht aktiv beschreibbar") wird verletzt.
- **Steps to Reproduce:**
  1. Admin archiviert Projekt P1 via `PATCH /api/admin/projekte/<P1>/archivieren`
  2. Mitarbeiter (im Team) ruft `POST /api/begehungen` mit `projekt_id=<P1>` auf
  3. Begehung wird mit Status 201 angelegt
- **Expected:** Server lehnt die Begehung mit 409/422 ab (z. B. "Projekt ist archiviert")
- **Actual:** Begehung wird normal erstellt
- **Datei:** `src/app/api/begehungen/route.ts` Z. 94–149
- **Fix-Vorschlag:** Vor `insert` Lookup auf `projekte.archived_at` für `begehungDaten.projekt_id`; bei nicht-null mit 409 antworten. Optional UI-Hinweis im Begehungs-Anlegen-Form.

#### BUG-003: Mitarbeiter-Direktzugriff auf nicht-zugeordnetes Projekt liefert 401/Redirect (UX)
- **Severity:** Low
- **Acceptance Criterion:** Edge Case "Mitarbeiter versucht nicht-zugeordnetes Projekt aufzurufen → 403 oder Redirect zur Projektliste"
- **Beschreibung:** Es existiert kein dedizierter Mitarbeiter-Endpunkt `/projekte/[id]` und kein API-Endpunkt `/api/projekte/[id]`. Mitarbeiter sehen nur die List-View `/projekte` (read-only Karten). Die Spec fordert "403 oder Redirect" — der aktuelle Stand erfüllt das de facto über Nicht-Existenz der Detailseite, aber das ist ein Spec-Gap, keine echte Implementierung. Ein versehentliches Tippen auf `/admin/projekte/<id>` wird durch Middleware nach `/` umgeleitet (kein 403, sondern Redirect).
- **Steps to Reproduce:**
  1. Login als Mitarbeiter
  2. Manuell `/admin/projekte/<beliebige-id>` in URL eingeben
  3. Beobachte Redirect zu `/` (Startseite)
- **Expected (laut Spec):** 403 ODER Redirect zur Projektliste — Redirect zu `/` ist keine der beiden Optionen
- **Actual:** Redirect zu `/`
- **Datei:** `src/middleware.ts` Z. 100–110
- **Fix-Vorschlag:** Bei nicht-Admin auf `/admin/*` zur Mitarbeiter-Projektliste `/projekte` redirecten statt zu `/`.

#### BUG-004: Kein Rate-Limit auf Projekt-Mutationen
- **Severity:** Low
- **Acceptance Criterion:** —
- **Beschreibung:** `middleware.ts` rate-limited nur Auth-Endpunkte. Ein Admin-Token (z. B. nach Account-Übernahme) erlaubt unbegrenzte POST-Anfragen an `/api/admin/projekte` und `/api/admin/projekte/[id]/mitarbeiter`. Für ein internes 10-Personen-Tool akzeptabel, aber als Defense-in-Depth-Schwäche zu vermerken.
- **Steps to Reproduce:** `for i in {1..1000}; do curl -X POST /api/admin/projekte -H 'Cookie: …' -d '{...}'; done`
- **Expected:** Rate Limit nach z. B. 30 req/min
- **Actual:** Alle 1000 Anfragen erfolgreich
- **Datei:** `src/middleware.ts`
- **Hinweis:** Niedrige Priorität wegen interner Nutzung. Wenn das System für externe Auftraggeber geöffnet wird (P2 Roadmap), neu bewerten.

#### BUG-005: PUT-Endpunkt erlaubt UPDATE auf bereits archivierte Projekte
- **Severity:** Low
- **Acceptance Criterion:** Implizit aus AC#7
- **Beschreibung:** `PUT /api/admin/projekte/[id]` enthält keine Prüfung auf `archived_at`. Ein Admin (oder kompromittierter Token) kann via API direkt Stammdaten archivierter Projekte ändern, obwohl das UI das durch `disabled`-Felder vorschlägt. Der Frontend-Schutz ist reine Cosmetics; serverseitig kann jedes Feld inklusive Kürzel überschrieben werden.
- **Steps to Reproduce:**
  1. Projekt P1 archivieren
  2. `PUT /api/admin/projekte/<P1>` mit `{"name":"Geändert"}` → 200 OK
- **Expected:** 409 mit Hinweis "Archiviertes Projekt kann nicht bearbeitet werden"
- **Actual:** Update wird durchgeführt
- **Datei:** `src/app/api/admin/projekte/[id]/route.ts` Z. 82–144
- **Fix-Vorschlag:** Vor Update prüfen ob `archived_at IS NOT NULL` und abbrechen (oder explizite "Reaktivieren"-Operation einführen).

#### BUG-006: Listen-API ohne Pagination
- **Severity:** Low
- **Acceptance Criterion:** —
- **Beschreibung:** `GET /api/admin/projekte` und `GET /api/projekte` haben ein hartes `.limit(500)`, aber keine Pagination/Cursor. Bei wachsendem Projektarchiv (>500) werden ältere Projekte abgeschnitten und sind nicht mehr auffindbar.
- **Steps to Reproduce:** 501+ Projekte anlegen; Projekt #501 ist in der UI nicht mehr erreichbar.
- **Expected:** Pagination via `?seite=2` oder Server-seitige Suche
- **Actual:** Stilles Abschneiden
- **Datei:** `src/app/api/admin/projekte/route.ts` Z. 43, `src/app/api/projekte/route.ts` Z. 24/57
- **Hinweis:** Für 10-Mitarbeiter-Büro mit ~30 aktiven Projekten unkritisch; bei Wachstum nachzubessern.

#### BUG-007: Admin sieht in `/api/projekte` keine `mitarbeiter_anzahl`
- **Severity:** Low
- **Acceptance Criterion:** —
- **Beschreibung:** Der Admin-Endpunkt `/api/admin/projekte` liefert `mitarbeiter_anzahl` (zur potenziellen Anzeige in Listen), aber `ProjektlisteCard.tsx` nutzt das Feld nicht in der Tabelle. Inkonsistenz zwischen API und UI.
- **Severity-Begründung:** Reine Cosmetics, keine funktionalen Folgen.
- **Datei:** `src/components/projekte/ProjektlisteCard.tsx`

---

### Test-Ausführung

```
> vitest run

 RUN  v4.1.2 /Users/ppb/Baubegehungsberichte

 Test Files  5 passed (5)
      Tests  27 passed (27)
   Start at  04:19:09
   Duration  719ms
```

Bestehende Tests (PROJ-1, PROJ-8, PROJ-2-Routes) bestehen alle. Keine Regressionen festgestellt.

#### Vorhandene PROJ-2-Unit-Tests
- `src/app/api/admin/projekte/route.test.ts` — 9 Tests (GET 401/403/200; POST 401/400 invalid kuerzel/missing field/invalid JSON/zu lang)
- `src/app/api/admin/projekte/[id]/archivieren/route.test.ts` — 4 Tests (401, 404, 409 already archived, success)
- `src/app/api/projekte/route.test.ts` — 4 Tests (401, Admin sees all, Mitarbeiter ohne Zuordnung, Mitarbeiter mit Zuordnung)

Abdeckung der API-Routen ausreichend für Sicherheits-Pfade. **Nicht abgedeckt** durch Unit-Tests: `[id]` GET/PUT, `[id]/mitarbeiter` GET/POST, `[id]/mitarbeiter/[nutzerId]` DELETE — diese Pfade wurden via Code-Review verifiziert.

---

### Responsives Design / Cross-Browser

Statisch verifiziert (keine Live-Browser-Session):
- `ProjektlisteCard.tsx`: `overflow-x-auto` auf Tabelle, `hidden sm:table-cell` und `hidden md:table-cell` für Spalten — Mobile-Tabelle kollabiert auf Projekt+Kürzel+Status.
- `NeueProjektDialog`: `max-h-[90vh] overflow-y-auto` + `sm:max-w-lg`, `grid grid-cols-2` für Datumspaare auch auf Mobile (eng aber funktional).
- `/projekte` (Mitarbeiter-View): Karten-Layout statt Tabelle — Mobile-First.
- `ProjektMitarbeiterCard`: Standard-Tabelle ohne Hide-Spalten — kann auf 375px etwas eng werden, aber `overflow-x-auto` fehlt → potenzieller Layout-Bug auf sehr kleinen Geräten.

**Beobachtung (Low-Severity):** `ProjektMitarbeiterCard` Tabelle hat keine horizontale Scroll-Hülle. Auf 375px mit langer E-Mail-Adresse + alle drei Badges (Rolle/Status/Aktion) kann die Tabelle überlappen. Nicht als formaler Bug erfasst, aber für künftiges UX-Polish vorgemerkt.

---

### Regressions-Check (gegen INDEX.md)

| Bestehende Feature | Test | Status |
|---|---|---|
| PROJ-1 (Authentifizierung) | Login-/Lockout-Tests in Suite | PASS |
| PROJ-8 (WhatsApp-Integration) | Webhook-Tests in Suite | PASS |
| RLS-Policies projekte | `002_projekte.sql` aktiviert RLS und definiert Admin/Mitarbeiter-Policies | PASS |

Keine Beeinträchtigung bestehender Features durch PROJ-2 festgestellt.

---

### Produktionsreife-Entscheidung

**READY** — BUG-002 (High) wurde behoben (commit `744db6b`). Keine weiteren Critical/High-Bugs offen.

**Verbleibende Bugs (alle Low/Medium, nicht blockierend):**
1. BUG-001 (Medium) — Anzahl Begehungsberichte auf Detailseite ergänzen
2. BUG-005 (Low) — PUT-Endpunkt soll archivierte Projekte ablehnen
3. BUG-003 (Low) — Mitarbeiter-Redirect zu `/` statt `/projekte`
4. BUG-004 (Low) — Rate-Limit auf Projekt-Mutationen
5. BUG-006 (Low) — Pagination fehlt
6. BUG-007 (Low) — `mitarbeiter_anzahl` in UI ungenutzt

## Deployment
_To be added by /deploy_
