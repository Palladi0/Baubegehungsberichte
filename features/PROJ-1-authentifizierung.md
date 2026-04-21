# PROJ-1: Benutzer-Authentifizierung

## Status: Planned
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
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
