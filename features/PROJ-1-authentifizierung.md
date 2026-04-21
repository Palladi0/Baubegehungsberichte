# PROJ-1: Benutzer-Authentifizierung

## Status: Architected
**Created:** 2026-04-21
**Last Updated:** 2026-04-21

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

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
