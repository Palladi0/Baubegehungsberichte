# PROJ-11: WhatsApp Business API Migration

## Status: Architected
**Created:** 2026-04-21
**Last Updated:** 2026-04-22

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

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
