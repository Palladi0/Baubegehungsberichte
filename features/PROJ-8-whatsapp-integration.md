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

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
