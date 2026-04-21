# PROJ-3: Begehungs-Erfassung

## Status: Architected
**Created:** 2026-04-21
**Last Updated:** 2026-04-21

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — Mitarbeiter muss eingeloggt sein
- Requires: PROJ-2 (Projektverwaltung) — Begehung wird einem Projekt zugeordnet

## Beschreibung
Mitarbeiter erfassen Baustellenbegehungen über ein strukturiertes Webformular. Neben manueller Eingabe kann der Mitarbeiter auch freitext-Notizen oder einen transkribierten Sprachtext eingeben — Claude (Anthropic API) extrahiert daraus automatisch strukturierte Felder wie Beteiligte, Wetterbedingungen, Leistungsstand und besondere Vorkommnisse. Der Mitarbeiter prüft die extrahierten Felder und speichert die Begehung ab.

## User Stories
- Als **Mitarbeiter** möchte ich eine neue Begehung für ein meiner Projekte anlegen, damit ich Baustellenfortschritte dokumentieren kann.
- Als **Mitarbeiter** möchte ich freitext-Notizen eingeben und die KI soll daraus automatisch strukturierte Felder befüllen, damit ich weniger manuell tippen muss.
- Als **Mitarbeiter** möchte ich alle extrahierten Felder vor dem Speichern prüfen und korrigieren, damit die Daten korrekt sind.
- Als **Mitarbeiter** möchte ich eine bereits erstellte Begehung nachbearbeiten können, damit Fehler korrigiert werden können.
- Als **Admin** möchte ich alle Begehungen aller Mitarbeiter einsehen können, damit ich eine Gesamtübersicht habe.

## Acceptance Criteria

### Pflichtfelder (Deckblatt des Berichts):
- [ ] Projekt (Auswahl aus zugeordneten Projekten)
- [ ] Datum der Begehung (Datumsauswahl, Default: heute)
- [ ] Uhrzeit der Begehung (Default: aktuelle Uhrzeit)
- [ ] Wetterbedingungen (Freitext oder Auswahl: Sonnig / Bewölkt / Regnerisch / Schnee / Nebel)
- [ ] Temperatur in °C (Zahlenfeld)
- [ ] Teilnehmer / Beteiligte (Liste von Namen und Rollen, dynamisch erweiterbar)

### Weitere Felder:
- [ ] Leistungsstand (Freitext, z. B. „Rohbau ca. 60% fertig")
- [ ] Besondere Vorkommnisse (Freitext, strukturierbar als Liste)
- [ ] Nächste Schritte / Maßnahmen (Freitext)
- [ ] Allgemeine Bemerkungen (Freitext)

### KI-Extraktion:
- [ ] Eingabefeld für Freitext-Notizen (Paste-fähig, min. 5 Zeilen)
- [ ] Button „KI-Extraktion starten" — Claude analysiert den Text und befüllt Formularfelder
- [ ] Extrahierte Felder werden visuell hervorgehoben (z. B. gelber Hintergrund) zur Prüfung
- [ ] Nutzer kann extrahierte Felder überschreiben
- [ ] Wenn KI kein Feld erkennen kann, bleibt es leer (kein Raten)
- [ ] Extraktion dauert max. 10 Sekunden; Fortschrittsanzeige sichtbar

### Allgemein:
- [ ] Formular speichert Entwurf automatisch alle 60 Sekunden (autosave)
- [ ] Begehung kann als „Entwurf" oder „Fertig" gespeichert werden
- [ ] Nur „Fertige" Begehungen können in einen Bericht aufgenommen werden

## Edge Cases
- Was passiert, wenn Claude nichts aus dem Text extrahieren kann? → Alle Felder bleiben leer; Toast-Nachricht: „Keine Felder erkannt. Bitte Felder manuell ausfüllen."
- Was passiert, wenn die Extraktion fehlschlägt (API-Timeout)? → Fehlermeldung; Freitext-Eingabe bleibt erhalten; manuelle Eingabe möglich.
- Was passiert, wenn eine Begehung mit dem gleichen Datum und Projekt bereits existiert? → Warnung (keine Blockierung): „Es existiert bereits eine Begehung für dieses Projekt an diesem Datum."
- Was passiert, wenn ein Mitarbeiter die Seite verlässt ohne zu speichern? → Browser-Verlassen-Dialog nur, wenn ungespeicherte Änderungen vorhanden.
- Was passiert bei der Bearbeitung einer bereits in einem Bericht enthaltenen Begehung? → Bearbeitung möglich, aber Warnung: „Diese Begehung ist bereits in einem Bericht enthalten. Änderungen aktualisieren den Bericht."

## Technical Requirements
- Claude-API-Prompt: strukturierte JSON-Antwort mit definierten Feldern (Datum, Teilnehmer, Wetter, Temperatur, Leistungsstand, Vorkommnisse, Maßnahmen)
- Extraktion erfolgt serverseitig (API-Key nie im Frontend)
- Formulardaten-Persistenz: autosave in localStorage als Backup; finale Daten nur in DB
- API-Endpunkte: GET /inspections, POST /inspections, PUT /inspections/:id, POST /inspections/extract

---

## Tech Design (Solution Architect)

### Gewählter Ansatz: Supabase Self-Hosted + Bright Sky API (DWD)

Begehungen werden in Supabase PostgreSQL gespeichert (konsistent mit PROJ-1). Wetterdaten werden automatisch via **Bright Sky API** (basiert auf DWD-Daten, kostenlos, kein API-Key) abgerufen. KI-Extraktion läuft über die Anthropic Claude API — ausschließlich server-seitig.

---

### Komponentenstruktur

```
/begehungen  (Listenansicht)
+-- BegehungenHeader          (Titel + "Neue Begehung"-Button)
+-- BegehungenTabelle
|   +-- Zeile pro Begehung    (Projekt | Datum | Status | Bearbeiter | Aktionen)
|   +-- StatusBadge           (Entwurf = grau / Fertig = grün)
+-- LeererZustand             (Hinweis wenn noch keine Begehungen vorhanden)

/begehungen/neu
/begehungen/[id]/bearbeiten
+-- BegehungsFormular
    +-- Abschnitt 1: Basisdaten
    |   +-- ProjektAuswahl            (shadcn/ui Select — lädt zugeordnete Projekte)
    |   +-- DatumFeld                 (shadcn/ui Input, type=date, Default: heute)
    |   +-- UhrzeitFeld               (shadcn/ui Input, type=time, Default: jetzt)
    |   +-- WetterAbrufenButton       ("Wetterdaten abrufen" — aktiv nach Projekt+Datum+Uhrzeit)
    |
    +-- Abschnitt 2: Wetter & Teilnehmer
    |   +-- WetterAuswahl             (shadcn/ui Select: Sonnig/Bewölkt/Regnerisch/Schnee/Nebel)
    |   |                             (wird automatisch vorausgefüllt via Bright Sky API)
    |   +-- TemperaturFeld            (shadcn/ui Input, type=number, Einheit °C)
    |   |                             (wird automatisch vorausgefüllt via Bright Sky API)
    |   +-- TeilnehmerListe           (dynamisch erweiterbar)
    |       +-- TeilnehmerZeile       (Name + Rolle + Löschen-Button pro Eintrag)
    |       +-- HinzufügenButton
    |
    +-- Abschnitt 3: KI-Extraktion  (optionaler Hilfs-Workflow)
    |   +-- FreitextTextarea          (shadcn/ui Textarea, min. 5 Zeilen, paste-fähig)
    |   +-- ExtraktionButton          ("KI-Extraktion starten")
    |   +-- FortschrittsAnzeige       (shadcn/ui Progress — sichtbar während API-Aufruf)
    |   +-- FehlerToast               (bei API-Timeout oder wenn kein Feld erkannt)
    |
    +-- Abschnitt 4: Inhaltliche Felder  (manuell oder KI-befüllt)
    |   +-- LeistungsstandFeld        (shadcn/ui Textarea — gelber Hintergrund wenn KI-befüllt)
    |   +-- VorkommnisseFeld          (shadcn/ui Textarea — gelber Hintergrund wenn KI-befüllt)
    |   +-- MaßnahmenFeld             (shadcn/ui Textarea — gelber Hintergrund wenn KI-befüllt)
    |   +-- Bemerkungsfeld            (shadcn/ui Textarea — gelber Hintergrund wenn KI-befüllt)
    |
    +-- Abschnitt 5: Formular-Aktionen
        +-- AutosaveIndikator         (Text: "Zuletzt gespeichert: vor 42 Sek.")
        +-- DuplikatWarnung           (shadcn/ui Alert — wenn Projekt+Datum bereits existiert)
        +-- BerichtWarnung            (shadcn/ui Alert — wenn Begehung bereits in Bericht)
        +-- EntwurfSpeichernButton    (shadcn/ui Button, variant=outline)
        +-- FertigSpeichernButton     (shadcn/ui Button, variant=default)
```

---

### Datenmodell

**Tabelle `begehungen`** — eine Zeile pro Baustellenbegehung:

| Feld | Typ | Beschreibung |
|---|---|---|
| ID | UUID | Eindeutige Kennung |
| Projekt-ID | UUID | Fremdschlüssel → Tabelle `projekte` (PROJ-2) |
| Bearbeiter-ID | UUID | Fremdschlüssel → Tabelle `nutzer_profile` (PROJ-1) |
| Datum | Datum | Tag der Begehung |
| Uhrzeit | Uhrzeit | Beginn der Begehung |
| Wetterbedingungen | Text | Sonnig / Bewölkt / Regnerisch / Schnee / Nebel |
| Temperatur | Zahl | In °C |
| Leistungsstand | Langtext | Freitext-Beschreibung des Baufortschritts |
| Besondere Vorkommnisse | Langtext | Freitext |
| Nächste Schritte | Langtext | Freitext |
| Allgemeine Bemerkungen | Langtext | Freitext |
| Status | Enum | `Entwurf` oder `Fertig` |
| Erstellt am | Zeitstempel | Automatisch gesetzt |
| Zuletzt geändert | Zeitstempel | Automatisch aktualisiert |

**Tabelle `begehung_teilnehmer`** — eine Zeile pro Person:

| Feld | Typ | Beschreibung |
|---|---|---|
| ID | UUID | Eindeutige Kennung |
| Begehungs-ID | UUID | Fremdschlüssel → `begehungen` |
| Name | Text | Vollständiger Name |
| Rolle | Text | z. B. „Bauleiter", „Statiker" |

> Teilnehmer als separate Tabelle: Die Anzahl ist variabel, und PROJ-5 (Berichtsgenerierung) muss sie einzeln aufführen.

**Neue Anforderung an PROJ-2 (Projektverwaltung):** Projekte müssen einen **Standort** speichern (Adresse oder GPS-Koordinaten), damit der Wetterabruf funktioniert. Wenn nur eine Adresse hinterlegt ist, wird einmalig über **Nominatim (OpenStreetMap)** geocodiert und die Koordinaten im Projekt gespeichert.

---

### Technische Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Datenpersistenz | Supabase PostgreSQL (Self-Hosted) | Konsistent mit PROJ-1; DSGVO-konform; Daten bleiben auf dem eigenen Server |
| Wetter-API | Bright Sky API (brightsky.dev) | Basiert auf offiziellem DWD-Datenmaterial; kostenlos; kein API-Key; sauberes JSON mit stündlichen Werten |
| Geocodierung | Nominatim (OpenStreetMap) | Kostenlos, kein API-Key, ausreichend genau für Baustellen in Deutschland |
| KI-Extraktion | Anthropic Claude API (`claude-sonnet-4-6`) | Strukturierte JSON-Antwort; Wetter-/Temperaturfelder werden ausgenommen (bessere Quelle: Bright Sky) |
| API-Key-Schutz | Alle externen API-Aufrufe ausschließlich in Next.js API Routes | Keys nie im Browser sichtbar |
| Autosave-Backup | localStorage alle 60 Sekunden | Schutz vor Datenverlust bei Verbindungsabbruch |
| Autosave final | Nur Supabase DB | localStorage ist Notfall-Backup, nicht Quelle der Wahrheit |
| KI-Hervorhebung | CSS-Klasse `bg-yellow-100` auf KI-befüllten Feldern | Nutzer erkennt sofort welche Felder die KI gesetzt hat |
| Verlassen-Schutz | `beforeunload`-Event im Browser | Nur aktiv wenn ungespeicherte Änderungen vorhanden |
| Duplikat-Check | API prüft beim Speichern: gleiche Projekt-ID + Datum | Warnung als Toast, keine Blockierung |
| Rollenzugriff | Mitarbeiter sehen nur eigene Begehungen; Admin sieht alle | Supabase Row-Level-Security (RLS) |

**Bright Sky Mapping:**

| Bright Sky `condition` | Formular-Anzeige |
|---|---|
| `clear` | Sonnig |
| `cloudy` / `partly-cloudy` | Bewölkt |
| `rain` / `sleet` | Regnerisch |
| `snow` | Schnee |
| `fog` | Nebel |
| sonstige | Bewölkt (Fallback) |

---

### API-Routen (Next.js)

| Route | Zweck | Berechtigung |
|---|---|---|
| `GET /api/begehungen` | Liste — Admin: alle; Mitarbeiter: nur eigene | Eingeloggt |
| `POST /api/begehungen` | Neue Begehung anlegen (Entwurf oder Fertig) | Mitarbeiter, Admin |
| `PUT /api/begehungen/[id]` | Begehung aktualisieren | Besitzer oder Admin |
| `POST /api/begehungen/extract` | Freitext → Claude API → strukturierte JSON-Felder | Eingeloggt |
| `GET /api/begehungen/wetter` | Wetterabruf via Bright Sky (lat, lon, datum, uhrzeit) | Eingeloggt |

---

### Infrastruktur-Übersicht

```
Browser (Next.js Client)
+-- React-Formular-State         (live während Eingabe)
+-- localStorage                 (Autosave-Backup alle 60 Sek.)
+-- API-Aufrufe
    |
    +-- GET /api/begehungen/wetter?lat=…&lon=…&datum=…&uhrzeit=…
    |       |
    |       v  Next.js API Route (Server)
    |       +-- Bright Sky API (brightsky.dev / DWD-Daten)
    |       +-- Mapping: condition → Sonnig/Bewölkt/Regnerisch/Schnee/Nebel
    |       Fallback: Felder bleiben leer wenn API nicht erreichbar
    |
    +-- POST /api/begehungen/extract
    |       |
    |       v  Next.js API Route (Server)
    |       +-- Auth-Prüfung via Supabase
    |       +-- Anthropic Claude API  ← einzige Stelle mit API-Key
    |       +-- Extrahiert: Teilnehmer, Leistungsstand, Vorkommnisse, Maßnahmen
    |       +-- Wetter/Temperatur explizit ausgenommen (Bright Sky ist verlässlicher)
    |
    +-- GET/POST/PUT /api/begehungen
            |
            v  Next.js API Route (Server)
            +-- Auth-Prüfung + RLS
            +-- Supabase PostgreSQL (Docker, VPS)
                +-- Tabelle: begehungen
                +-- Tabelle: begehung_teilnehmer
```

---

### Neue Abhängigkeiten

| Paket | Zweck |
|---|---|
| `@anthropic-ai/sdk` | Offizieller Claude API Client (server-seitig, für KI-Extraktion) |

Bright Sky und Nominatim benötigen keine Client-Pakete — beide werden via einfachem `fetch` aufgerufen. Alle weiteren Pakete (react-hook-form, Zod, shadcn/ui) sind bereits im Stack vorhanden.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
