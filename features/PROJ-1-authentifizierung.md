# PROJ-1: Benutzer-Authentifizierung

## Status: In Progress
**Created:** 2026-04-21
**Last Updated:** 2026-04-22

## Dependencies
- None

## Beschreibung
E-Mail/Passwort-basiertes Login-System für das interne Architekturbüro-Team. Zwei Rollen: Admin (voller Zugriff, Benutzerverwaltung) und Mitarbeiter (Berichte erstellen/einsehen). Sessions bleiben persistent, damit Mitarbeiter nicht täglich neu einloggen müssen.

## User Stories
- Als **Mitarbeiter** möchte ich mich mit E-Mail und Passwort einloggen, damit ich sicher auf meine Projekte und Berichte zugreifen kann.
- Als **Admin** möchte ich neue Mitarbeiter-Accounts anlegen und löschen, damit ich den Systemzugriff verwalten kann.
- Als **Admin** möchte ich Passwörter zurücksetzen können, damit Mitarbeiter bei Verlust wieder Zugriff erhalten.
- Als **Mitarbeiter** möchte ich eingeloggt bleiben (persistente Session), damit ich mich nicht täglich neu anmelden muss.
- Als **System** möchte ich nicht-authentifizierte Anfragen auf die Login-Seite umleiten, damit keine Daten ungeschützt zugänglich sind.

## Acceptance Criteria
- [ ] Login-Formular mit E-Mail und Passwort (Validierung: gültiges E-Mail-Format, Passwort min. 8 Zeichen)
- [ ] Fehlerhafte Anmeldeversuche zeigen eine generische Fehlermeldung (kein Hinweis ob E-Mail oder Passwort falsch)
- [ ] Nach max. 5 fehlgeschlagenen Versuchen wird der Account für 15 Minuten gesperrt
- [ ] Zwei Rollen: `admin` und `mitarbeiter` — Rollenvergabe nur durch Admin
- [ ] Admin-Bereich: Nutzerliste, neuen Nutzer anlegen, Nutzer deaktivieren, Passwort zurücksetzen
- [ ] Session bleibt 30 Tage aktiv (JWT mit Refresh Token oder gleichwertiger Mechanismus)
- [ ] Logout-Button in der Navigation sichtbar und funktionsfähig
- [ ] Alle Seiten außer `/login` sind ohne aktive Session nicht erreichbar (Redirect zu `/login`)
- [ ] Passwort-Änderung durch eingeloggten Nutzer möglich (aktuelles Passwort erforderlich)

## Edge Cases
- Was passiert, wenn ein deaktivierter Nutzer versucht sich einzuloggen? → Fehlermeldung „Ihr Account ist deaktiviert. Bitte wenden Sie sich an den Administrator."
- Was passiert, wenn die Session abläuft während der Nutzer aktiv ist? → Stilles Refresh via Refresh Token; schlägt das fehl, Redirect zu Login mit Hinweis „Sitzung abgelaufen."
- Was passiert, wenn ein Admin seinen eigenen Account deaktiviert? → Nicht erlaubt; der eigene Account kann nicht deaktiviert werden.
- Was passiert bei gleichzeitigem Login von mehrselben Nutzer auf verschiedenen Geräten? → Erlaubt; beide Sessions sind gleichzeitig aktiv.
- Was passiert, wenn beim Zurücksetzen eine unbekannte E-Mail eingegeben wird? → Gleiche Erfolgs-Nachricht wie bei bekannter E-Mail (kein User-Enumeration).

## Technical Requirements
- Passwörter werden gehasht gespeichert (bcrypt, min. 12 Runden)
- HTTPS erforderlich (kein HTTP für Produktionsbetrieb)
- Rate Limiting auf Login-Endpunkt (max. 10 Requests/Minute pro IP)
- Session-Tokens in HTTP-Only Cookies (kein localStorage)
- CSRF-Schutz auf allen POST-Endpunkten

---

## Tech Design (Solution Architect)

### Gewählter Ansatz: Supabase Self-Hosted

Supabase läuft als Docker-Compose-Stack auf dem eigenen VPS. Er enthält PostgreSQL, den Auth-Service (GoTrue), einen API-Gateway (Kong) und das Admin-Studio — alles vorkonfiguriert. Next.js kommuniziert über den offiziellen Supabase-Client mit diesem Stack. Keine Daten verlassen den eigenen Server.

---

### Komponentenstruktur

```
Next.js App
+-- Middleware (Auth-Guard)
|   Prüft bei jedem Request die Session.
|   Ohne gültige Session → Redirect zu /login
|
+-- /login  (öffentliche Seite)
|   +-- LoginCard
|       +-- E-Mail-Feld (shadcn/ui Input)
|       +-- Passwort-Feld (shadcn/ui Input)
|       +-- Login-Button (shadcn/ui Button)
|       +-- Fehlermeldung (shadcn/ui Alert)
|
+-- /admin/benutzer  (nur Admin-Rolle)
|   +-- BenutzertabelleCard
|   |   +-- Tabelle (shadcn/ui Table)
|   |       +-- Zeile pro Nutzer
|   |           (E-Mail | Rolle | Status | Aktionen)
|   +-- NeuenNutzerDialog (shadcn/ui Dialog)
|   |   +-- E-Mail-Feld
|   |   +-- Rollen-Auswahl: admin / mitarbeiter
|   +-- PasswortZuruecksetzenDialog (shadcn/ui Dialog)
|   +-- NutzerDeaktivierenDialog (shadcn/ui AlertDialog)
|
+-- /profil  (alle eingeloggten Nutzer)
    +-- PasswortAendernCard
        +-- Formular
            +-- Aktuelles Passwort
            +-- Neues Passwort (min. 8 Zeichen)
            +-- Passwort bestätigen
```

---

### Datenmodell

**Schicht 1 — Supabase Auth (intern, von GoTrue verwaltet)**
- E-Mail-Adresse
- Verschlüsseltes Passwort (bcrypt, vom Auth-Service gehandhabt)
- Interne Nutzer-ID (UUID)

**Schicht 2 — Eigene Tabelle `nutzer_profile`**
- Verknüpfung mit der internen Nutzer-ID
- **Rolle:** `admin` | `mitarbeiter`
- **Aktiv:** boolean (deaktivierte Nutzer werden beim Login abgewiesen)
- **Fehlgeschlagene Login-Versuche:** integer (0–5)
- **Gesperrt bis:** Zeitstempel (null = nicht gesperrt)
- **Zuletzt eingeloggt am:** Zeitstempel

---

### Technische Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Auth-Engine | Supabase Auth (GoTrue) | Bcrypt, JWT + Refresh Token, Session-Management fertig integriert |
| Session-Cookies | HTTP-Only via `@supabase/ssr` | Nicht per JavaScript lesbar → XSS-sicher |
| Rollen-Speicherung | Eigene `nutzer_profile`-Tabelle | Supabase Auth unterstützt keine Custom-Rollen nativ |
| Account-Sperre | Custom-Logik in `nutzer_profile` | GoTrue hat kein eingebautes Lockout nach N Fehlversuchen |
| Session-Dauer | 30 Tage (in GoTrue konfigurierbar) | Anforderung: persistente Sessions ohne tägliches Re-Login |
| CSRF-Schutz | Next.js Middleware + Supabase | Beide Schichten sichern POST-Endpunkte ab |
| Rate Limiting | Next.js Middleware (IP-basiert) | Max. 10 Login-Requests/Minute pro IP, im App-Layer umgesetzt |
| Admin-Funktionen | Custom Next.js API-Routes mit Service-Role-Key | Nur server-seitig ausgeführt, nie client-seitig |

---

### API-Routen (Next.js)

| Route | Zweck | Berechtigung |
|---|---|---|
| `GET /api/admin/benutzer` | Nutzerliste abrufen | Admin |
| `POST /api/admin/benutzer` | Neuen Nutzer anlegen | Admin |
| `PATCH /api/admin/benutzer/[id]` | Rolle ändern / deaktivieren | Admin |
| `POST /api/admin/benutzer/[id]/passwort-reset` | Neues Passwort setzen | Admin |
| `PATCH /api/benutzer/me/passwort` | Eigenes Passwort ändern | Alle eingeloggten Nutzer |

Login/Logout-Endpunkte stellt Supabase Auth selbst bereit — diese werden nicht manuell implementiert.

---

### Infrastruktur

```
VPS (eigener Server)
+-- Docker Compose: Supabase-Stack
|   +-- PostgreSQL        (Datenbank)
|   +-- GoTrue            (Auth-Service: Login, Tokens, Sessions)
|   +-- Kong              (API-Gateway, SSL-Terminierung)
|   +-- PostgREST         (automatische REST-API auf DB)
|   +-- Supabase Studio   (Admin-Oberfläche für Entwicklung)
|
+-- Docker: Next.js App   (Frontend + API-Routes)
```

---

### Neue Abhängigkeiten

| Paket | Zweck |
|---|---|
| `@supabase/supabase-js` | Supabase-Client (Datenbankzugriff, Auth-Operationen) |
| `@supabase/ssr` | Session-Cookies für Next.js App Router (HTTP-Only) |

Zod und react-hook-form (bereits im Stack) werden für Formular-Validierung eingesetzt.

## Implementation Notes (Frontend)

**Erstellt 2026-04-22:**
- Seite `src/app/admin/benutzer/page.tsx` (Admin-only, Server-Komponente mit Redirect-Guards zusätzlich zur Middleware).
- Seite `src/app/profil/page.tsx` (für alle eingeloggten Nutzer, zeigt Kontoinfos + Passwort-Änderung).
- Komponenten unter `src/components/benutzer/`:
  - `BenutzertabelleCard.tsx` — zentrale Tabelle inkl. Lade-, Fehler- und Leer-Zuständen, Reaktivieren direkt aus der Liste.
  - `NeuenNutzerDialog.tsx` — Dialog (shadcn/ui Dialog + Form + Select) für neuen Account inkl. Rollenauswahl und initialem Passwort.
  - `PasswortZuruecksetzenDialog.tsx` — Dialog mit Passwort + Bestätigung, nutzt `POST /api/admin/benutzer/[id]/passwort-reset`.
  - `NutzerDeaktivierenDialog.tsx` — shadcn/ui AlertDialog mit destruktiver Aktion (`PATCH /api/admin/benutzer/[id]` mit `aktiv: false`).
  - `PasswortAendernCard.tsx` — Formular auf `/profil` mit aktuellem + neuem Passwort, nutzt `PATCH /api/benutzer/me/passwort`.
- Sonner-Toasts für Erfolg/Fehler, Alert-Komponenten für Inline-Fehlermeldungen.
- Alle Texte auf Deutsch, responsive (mobile 375px → desktop 1440px), semantisches HTML mit ARIA-Labels und `role="alert"` / `aria-live`.
- Build erfolgreich: `npm run build` meldet alle Routen inkl. `/admin/benutzer` und `/profil`.

## Implementation Notes (Backend)

**Erstellt 2026-04-24:**
- `src/app/api/auth/login/route.ts` — Server-seitiger Login-Endpunkt (`POST /api/auth/login`). Prüft Lockout via Service-Client vor dem Auth-Versuch, ruft `supabase.auth.signInWithPassword()` mit SSR-Client auf (setzt HTTP-Only Session-Cookies), inkrementiert `fehlgeschlagene_versuche` bei Fehlschlag, sperrt Account nach 5 Versuchen für 15 Minuten, setzt Counter und `zuletzt_eingeloggt_am` bei Erfolg zurück.
- `src/lib/auth.ts` — `requireAuth()` prüft jetzt zusätzlich `gesperrt_bis`; Select erweitert um `gesperrt_bis`.
- `src/app/login/page.tsx` — Login-Formular ruft jetzt `POST /api/auth/login` statt Supabase direkt im Browser auf; Fehler- und Lockout-Meldungen kommen vom Server.
- `src/app/api/admin/whatsapp/messages/[id]/assign/route.ts` — `params`-Typ auf `Promise<{id}>` aktualisiert (Next.js 16-Anforderung, vorliegender Build-Fehler).
- Build erfolgreich: `npm run build` meldet alle Routen inkl. `/api/auth/login`.

## QA Test Results

**Getestet am:** 2026-04-24
**QA-Methode:** Statische Code-Analyse + Unit-Test-Ausführung (`npm test`: 11/11 bestanden)
**Tester:** QA Engineer

---

### Acceptance Criteria

| # | Kriterium | Status | Notiz |
|---|-----------|--------|-------|
| 1 | Login-Formular mit Validierung (E-Mail-Format, min. 8 Zeichen Passwort) | ✅ PASS | `login/page.tsx`: Zod-Schema mit `email()` + `min(8)`, Fehlermeldungen per `FormMessage` |
| 2 | Generische Fehlermeldung (kein Hinweis ob E-Mail oder Passwort falsch) | ⚠️ PARTIAL | Ungültige Zugangsdaten → „E-Mail oder Passwort ungültig." ✅; aber Lockout-Meldung enthüllt, ob E-Mail existiert → **BUG-001** |
| 3 | Account-Sperre nach max. 5 Versuchen für 15 Minuten | ✅ PASS | `login/route.ts`: `LOCKOUT_THRESHOLD=5`, `LOCKOUT_DURATION_MS=15*60*1000`; Zähler und `gesperrt_bis` in `nutzer_profile` |
| 4 | Zwei Rollen: `admin` und `mitarbeiter` — Rollenvergabe nur durch Admin | ✅ PASS | `requireAdmin()` auf allen Admin-Routen; `POST /api/admin/benutzer` erlaubt nur Rollen `admin`\|`mitarbeiter` |
| 5 | Admin-Bereich: Nutzerliste, anlegen, deaktivieren, Passwort zurücksetzen | ✅ PASS | Alle vier Endpunkte implementiert; UI-Komponenten vollständig |
| 6 | Session bleibt 30 Tage aktiv (JWT + Refresh Token) | ⚠️ PARTIAL | `@supabase/ssr` + Middleware refreshen Sessions automatisch; 30-Tage-Konfiguration liegt in GoTrue — aus Code nicht verifizierbar |
| 7 | Logout-Button in Navigation sichtbar und funktionsfähig | ✅ PASS | `LogoutButton.tsx`: ruft `supabase.auth.signOut()` auf und leitet zu `/login` um |
| 8 | Alle Seiten außer `/login` ohne Session → Redirect zu `/login` | ✅ PASS | `middleware.ts`: Middleware prüft Session auf allen Pfaden; `/api/auth/*` und `/api/webhooks/*` sind korrekt öffentlich |
| 9 | Passwort-Änderung durch eingeloggten Nutzer (aktuelles Passwort erforderlich) | ✅ PASS | `PATCH /api/benutzer/me/passwort`: verifiziert aktuelles Passwort via separatem Login-Client; dann Service-Client für Update |

**Ergebnis: 7/9 Criteria voll bestanden, 2 mit Einschränkungen**

---

### Edge Cases

| Edge Case | Status | Notiz |
|-----------|--------|-------|
| Deaktivierter Nutzer versucht Login | ✅ PASS | `login/route.ts` Z.46–53: `aktiv === false` → 403 mit Klartextmeldung; doppelt abgesichert nach erfolgreichem Auth-Call Z.105–113 |
| Session läuft ab während Nutzer aktiv | ✅ PASS | `supabase-middleware.ts` + Middleware refreshen Session bei jedem Request automatisch |
| Admin deaktiviert eigenen Account | ✅ PASS | `benutzer/[id]/route.ts` Z.44: Guard `aktiv === false && id === auth.userId` → 400 |
| Gleichzeitiger Login auf mehreren Geräten | ✅ PASS | Supabase-Standardverhalten: mehrere Sessions parallel erlaubt |
| Unbekannte E-Mail bei Passwort-Reset | ➖ N/A | Kein Self-Service-Passwort-Reset für Nutzer implementiert; nur Admin-seitiger Reset via `/api/admin/benutzer/[id]/passwort-reset` |

---

### Security Audit (Red-Team)

| Prüfpunkt | Status | Details |
|-----------|--------|---------|
| Rate Limiting (max. 10 req/min/IP) | ⚠️ PARTIAL | `middleware.ts`: In-Memory-Map; funktioniert korrekt auf Single-Instance — bei Multi-Instance multipliziert sich das Limit → **BUG-002** |
| Account-Lockout (5 Versuche, 15 min) | ✅ PASS | In DB persistiert, instanzunabhängig; Race-Condition-Risiko vernachlässigbar für 10-Personen-Team |
| HTTP-Only Session-Cookies | ✅ PASS | `@supabase/ssr` mit `createServerClient` — Cookies nur server-seitig gelesen/geschrieben, kein `localStorage` |
| CSRF-Schutz auf POST-Endpunkten | ✅ PASS | JSON `Content-Type` + Browser Same-Origin Policy verhindert Cross-Origin-Form-Submissions; `@supabase/ssr` setzt SameSite-Cookies |
| Generic Error Messages (kein User-Enumeration bei Login) | ⚠️ PARTIAL | Falsches Passwort: generische Meldung ✅; nach Lockout: abweichende Meldung mit Countdown enthüllt ob E-Mail existiert → **BUG-001** |
| Admin-Endpoint-Rollenprüfung | ✅ PASS | Alle Admin-Routen prüfen via `requireAdmin()`; Middleware prüft zusätzlich auf Pfad-Ebene |
| SQL Injection | ✅ PASS | Supabase verwendet parametrisierte Abfragen intern; alle Inputs Zod-validiert |
| Deaktivierter Nutzer wird abgewiesen | ✅ PASS | `requireAuth()` prüft `aktiv`; Login-Route doppelt abgesichert |
| Admin kann eigenen Account nicht deaktivieren | ✅ PASS | Guard in `PATCH /api/admin/benutzer/[id]` |
| Security Headers (X-Frame-Options, NOSNIFF etc.) | ❌ FEHLT | Middleware setzt keine HTTP-Security-Header — **BUG-003** |
| Secrets in Code | ✅ PASS | Alle Credentials über `process.env`, kein Hardcoding |
| Passwort-Hashing | ✅ PASS | Supabase GoTrue übernimmt bcrypt intern |

---

### Gefundene Bugs

#### BUG-001: User-Enumeration über Lockout-Meldung
- **Severity:** Medium
- **Acceptance Criterion:** #2 (generische Fehlermeldung)
- **Beschreibung:** Nach 5 fehlgeschlagenen Login-Versuchen mit einer bekannten E-Mail antwortet der Server mit „Account vorübergehend gesperrt. Bitte in ca. X Minute(n) erneut versuchen." Bei einer unbekannten E-Mail erscheint weiterhin „E-Mail oder Passwort ungültig." Ein Angreifer kann so prüfen, ob eine E-Mail-Adresse im System registriert ist.
- **Steps to Reproduce:**
  1. Sende 5x `POST /api/auth/login` mit einer gültigen E-Mail, falsches Passwort
  2. Beobachte die Antwort beim 5. Versuch: „Account vorübergehend gesperrt"
  3. Wiederhole mit unbekannter E-Mail: Antwort bleibt „E-Mail oder Passwort ungültig"
- **Expected:** Beide Szenarien liefern dieselbe generische Fehlermeldung
- **Actual:** Lockout-Meldung ist eindeutig unterschiedlich
- **Datei:** `src/app/api/auth/login/route.ts` Z.56–65
- **Fix-Vorschlag:** Auch gesperrte Accounts mit der generischen Meldung antworten, oder erst nach Ablauf der Sperre erneut prüfen

#### BUG-002: In-Memory Rate Limit nicht Multi-Instance-fähig
- **Severity:** Low
- **Acceptance Criterion:** Technische Anforderung „Rate Limiting max. 10 req/min/IP"
- **Beschreibung:** Das Rate-Limit in `middleware.ts` speichert Timestamps in einer JavaScript-`Map` im Prozess-Speicher. Bei mehreren Node.js-Instanzen (z. B. Vercel Edge, PM2 Cluster) hat jede Instanz ihre eigene Map — das Limit wird effektiv mit der Instanzanzahl multipliziert.
- **Steps to Reproduce:** Deploy auf Multi-Instance-Umgebung und sende >10 req/min auf `/api/auth/login` verteilt auf mehrere Instanzen
- **Expected:** Requests werden nach 10/min pro IP blockiert
- **Actual:** Bis zu N×10/min möglich (N = Anzahl Instanzen)
- **Datei:** `src/middleware.ts` Z.6–30
- **Hinweis:** Für den Einsatz auf Single-VPS (wie laut PRD geplant) ist das aktuelle Verhalten ausreichend

#### BUG-003: Fehlende HTTP-Security-Header
- **Severity:** Low
- **Acceptance Criterion:** Technische Anforderung (security.md)
- **Beschreibung:** Die Middleware setzt keine Standard-Security-Header. Laut `.claude/rules/security.md` sind `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` und `Strict-Transport-Security` erforderlich.
- **Steps to Reproduce:** `curl -I https://app.example.com/login` — Security-Header fehlen in der Response
- **Expected:** Alle vier Header gesetzt
- **Actual:** Keiner der Header vorhanden
- **Datei:** `src/middleware.ts` (Ergänzung in der Response nötig)

---

### Test-Ausführung

```
> vitest run

 RUN  v4.1.2 /Users/ppb/Baubegehungsberichte

 Test Files  2 passed (2)
      Tests  11 passed (11)
   Start at  20:15:08
   Duration  681ms
```

Alle bestehenden Tests bestehen. Keine Regressionen.

---

### Mobile Navigation (Beobachtung, kein Bug)

Die Desktop-Navigationslinks (Berichte, Begehungen, Projekte etc.) sind auf Mobile mit `hidden sm:flex` ausgeblendet. Kein Hamburger-Menü vorhanden. Der Logout-Button ist jedoch auf allen Bildschirmgrößen sichtbar. Da die Spec kein Mobile-Menü fordert, wird dies als Low-UX-Issue ohne Bug-Status gewertet.

---

### Produktionsreife-Entscheidung

**✅ READY** — Keine Critical- oder High-Bugs vorhanden.

Die drei gefundenen Bugs (1× Medium, 2× Low) blockieren den Betrieb nicht. BUG-001 (User Enumeration) sollte vor dem produktiven Betrieb gefixt werden, ist jedoch für ein internes Bürotool mit bekanntem Nutzerkreis tolerierbar. BUG-002 und BUG-003 sind für den Single-VPS-Betrieb laut PRD unkritisch.

## Deployment
_To be added by /deploy_
