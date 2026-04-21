# PROJ-8: WhatsApp-Integration (Twilio Sandbox)

## Status: Planned
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
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
