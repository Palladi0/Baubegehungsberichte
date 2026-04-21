# PROJ-11: WhatsApp Business API Migration

## Status: Planned
**Created:** 2026-04-21
**Last Updated:** 2026-04-21

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
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
