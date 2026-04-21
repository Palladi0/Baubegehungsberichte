# Product Requirements Document

## Vision
Ein webbasiertes, KI-gestütztes Berichtstool für Baustellenbegehungen, das ein 10-köpfiges Architekturbüro dabei unterstützt, Baustellenbegehungen professionell und effizient zu dokumentieren. Mitarbeiter senden Sprachnachrichten und Fotos über WhatsApp, die KI verarbeitet sie automatisch, und das System generiert daraus einen druckfertigen PDF-Bericht — täglich, strukturiert und ohne manuellen Aufwand.

## Target Users

### Primäre Nutzer: Architekten & Bauleiter (10 Mitarbeiter)
- Führen täglich Baustellenbegehungen durch
- Haben wenig Zeit für manuelle Dokumentation direkt vor Ort
- Nutzen WhatsApp bereits intensiv für Kommunikation
- Benötigen professionelle, rechtssichere Berichte für Auftraggeber und Behörden
- **Pain Points:** Berichtserstellung kostet 30–60 Minuten pro Begehung, Fotos müssen manuell sortiert und beschriftet werden, keine einheitliche Berichtsstruktur

### Sekundäre Nutzer: Büro-Administration / Admin
- Verwaltet Projekte und Mitarbeiterzuordnungen
- Überprüft und gibt Berichte frei
- Exportiert und versendet Berichte an Auftraggeber

## Core Features (Roadmap)

| Priorität | Feature | Status |
|-----------|---------|--------|
| P0 (MVP) | Benutzer-Authentifizierung (E-Mail/Passwort, Admin + Mitarbeiter) | Planned |
| P0 (MVP) | Projektverwaltung (CRUD, Projektnummern, Mitarbeiterzuordnung) | Planned |
| P0 (MVP) | Begehungs-Erfassung (Manuelle Eingabe + KI-Extraktion via Claude) | Planned |
| P0 (MVP) | Medien-Verwaltung (Foto-Upload, Projektzuordnung, Self-Hosted) | Planned |
| P0 (MVP) | Berichtsgenerierung (Dynamischer HTML-Bericht: Deckblatt + Projektseiten) | Planned |
| P0 (MVP) | PDF-Export (Professioneller, druckfertiger PDF-Export) | Planned |
| P0 (MVP) | Berichte-Dashboard (Übersicht, Filter, Bearbeiten, Löschen) | Planned |
| P1 | WhatsApp-Integration (Twilio Sandbox: Empfang von Nachrichten + Fotos) | Planned |
| P1 | Sprach-Transkription (Whisper API, Deutsch) | Planned |
| P1 | Automatische Projektzuordnung (Hashtag-Erkennung, Absender-Mapping) | Planned |
| P2 | WhatsApp Business API Migration (Sandbox → Produktion) | Planned |
| P2 | Erweiterte Berichtsvorlagen (Custom Templates, Firmenlogo, CI) | Planned |

## Success Metrics
- **Zeitersparnis:** Berichtserstellung von ~45 min auf <10 min reduziert
- **Vollständigkeit:** ≥ 95 % der gesendeten Fotos korrekt einem Projekt zugeordnet
- **Qualität:** Berichte werden ohne Nachbearbeitung direkt an Auftraggeber versendet
- **Adoption:** Alle 10 Mitarbeiter nutzen das System aktiv innerhalb von 4 Wochen nach Launch
- **Zuverlässigkeit:** System-Uptime > 99 % während Bürozeiten (7–19 Uhr)

## Constraints
- **Team:** 10 Mitarbeiter, keine dedizierte IT-Abteilung
- **Sprache:** Vollständig auf Deutsch (UI, KI-Extraktion, PDF-Berichte)
- **Infrastruktur:** Self-hosted (eigener Server oder VPS), kein Cloud-Lock-in
- **KI:** Anthropic Claude für Inhaltsextraktion + Bildanalyse; OpenAI Whisper für Sprach-Transkription
- **WhatsApp:** Twilio Sandbox für Entwicklung/Test; WhatsApp Business API für Produktion (P2)
- **Datenschutz:** DSGVO-konform — Baustellen-Fotos und Projektdaten verbleiben auf eigenem Server
- **Budget:** Laufende KI-Kosten sollten unter 50 €/Monat bleiben (Pay-per-Use)
- **Projektzuordnung:** Mitarbeiter kennzeichnen Nachrichten mit Projektkürzel (z. B. `#BV-23-Hamburg`)

## Non-Goals
- Keine mobile App (PWA reicht aus)
- Kein externes Nutzerportal für Auftraggeber (P2/später)
- Keine Echtzeit-Kollaboration / gleichzeitiges Bearbeiten
- Kein Rechnungs- oder Zeiterfassungsmodul
- Kein Ersatz für eine vollständige Bausoftware (kein BIM, kein Aufmaß)
- Keine automatische E-Mail-Zustellung von Berichten (manueller Export reicht für MVP)
