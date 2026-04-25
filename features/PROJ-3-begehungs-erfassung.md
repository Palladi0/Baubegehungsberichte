# PROJ-3: Begehungs-Erfassung

## Status: In Review
**Created:** 2026-04-21
**Last Updated:** 2026-04-25

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

## Implementation Notes (2026-04-22)
- Alle API-Routen erstellt: GET/POST /api/begehungen, PUT/DELETE /api/begehungen/[id], POST /api/begehungen/extract, GET /api/begehungen/wetter
- DB-Migration 003_begehungen.sql: Tabellen `begehungen` + `begehung_teilnehmer`, RLS-Policies, lat/lon-Spalten auf `projekte` (für Bright Sky)
- @anthropic-ai/sdk installiert; KI-Extraktion server-seitig via claude-sonnet-4-6
- Wetter-Abruf via Bright Sky API + Nominatim-Geocodierung (kein API-Key nötig)
- Autosave alle 60 Sek. in localStorage als Backup
- Verlassen-Schutz via beforeunload-Event
- KI-befüllte Felder gelb hervorgehoben (bg-yellow-50)
- Duplikat-Warnung (Projekt + Datum) als Alert, keine Blockierung
- Routing: /begehungen (Liste), /begehungen/neu, /begehungen/[id]/bearbeiten
- Navigation um "Begehungen" und "Projekte" erweitert

## QA Test Results

**Getestet am:** 2026-04-25
**QA-Methode:** Statische Code-Analyse + Unit-Tests (`npm test`: 54/54 bestanden) + E2E-Tests (`npm run test:e2e`: 7/25 bestanden, 18 skipped — erfordern echte DB-Session) + Red-Team-Security-Audit
**Tester:** QA Engineer

---

### Acceptance Criteria

| # | Kriterium | Status | Notiz |
|---|-----------|--------|-------|
| 1 | Projekt (Auswahl aus zugeordneten Projekten) | ✅ PASS | `BegehungsFormular.tsx`: shadcn/ui Select; `neu/page.tsx` + `bearbeiten/page.tsx` laden via `ladeProjekteDesMitarbeiters()`; nur nicht-archivierte Projekte |
| 2 | Datum (Default: heute) | ✅ PASS | `heuteDatum()` liefert `toISOString().split('T')[0]`; `Input type=date` |
| 3 | Uhrzeit (Default: aktuelle Uhrzeit) | ✅ PASS | `jetztUhrzeit()` liefert HH:MM; `Input type=time` |
| 4 | Wetterbedingungen (Auswahl: Sonnig/Bewölkt/Regnerisch/Schnee/Nebel) | ✅ PASS | shadcn/ui Select mit `WETTERBEDINGUNGEN`-Konstante aus `types.ts` |
| 5 | Temperatur in °C (Zahlenfeld) | ✅ PASS | `Input type=number step=0.1`; server-seitig `z.number().nullable()` |
| 6 | Teilnehmer dynamisch erweiterbar (Name + Rolle) | ✅ PASS | `TeilnehmerListe.tsx`; `handleHinzufuegen()`/`handleEntfernen()`; separate DB-Tabelle `begehung_teilnehmer` |
| 7 | Leistungsstand (Freitext) | ✅ PASS | Textarea; KI-befüllbar; `bg-yellow-50` Hervorhebung |
| 8 | Besondere Vorkommnisse (Freitext) | ✅ PASS | Textarea; KI-befüllbar |
| 9 | Nächste Schritte / Maßnahmen (Freitext) | ✅ PASS | Textarea; KI-befüllbar |
| 10 | Allgemeine Bemerkungen (Freitext) | ✅ PASS | Textarea; KI-befüllbar |
| 11 | KI-Extraktion Eingabefeld (min. 5 Zeilen, paste-fähig) | ✅ PASS | `Textarea rows={6} className="resize-y"`; `aria-label` gesetzt |
| 12 | Button „KI-Extraktion starten" — Claude extrahiert Felder | ✅ PASS | `handleKiExtraktion()`; API-Aufruf auf `/api/begehungen/extract`; `claude-sonnet-4-6` server-seitig |
| 13 | Extrahierte Felder gelb hervorgehoben | ✅ PASS | `kiBefuellt`-Set steuert `bg-yellow-50 border-yellow-300`; Hinweistext erscheint |
| 14 | Nutzer kann extrahierte Felder überschreiben (Hervorhebung verschwindet) | ✅ PASS | `setFeld()` entfernt Feld aus `kiBefuellt` bei manuellem Edit |
| 15 | KI lässt leere Felder leer (kein Raten) | ✅ PASS | System-Prompt explizit: „leer lassen / null wenn nicht erkennbar"; `hatInhalt`-Check |
| 16 | Extraktion max. 10 Sek.; Fortschrittsanzeige | ⚠️ PARTIAL | Progress-Bar und `KI analysiert Text …` korrekt sichtbar; **kein 10-Sekunden-Timeout erzwungen** (API-Aufruf hat kein AbortSignal) |
| 17 | Autosave alle 60 Sek. in localStorage | ⚠️ PARTIAL | Für neue Begehungen: ✅; für Bearbeiten-Modus: ❌ (`initialDaten` überschreibt localStorage beim Laden, autosave schreibt aber nie zurück) — **BUG-002** |
| 18 | Begehung als „Entwurf" oder „Fertig" speichern | ✅ PASS | Zwei getrennte Buttons: `handleSpeichern('Entwurf')` und `handleSpeichern('Fertig')`; `status`-Enum in DB |
| 19 | Nur „Fertige" Begehungen in Bericht aufnehmbar | ✅ PASS | Spec-konform; RLS-Policies + `status`-Feld korrekt implementiert; PROJ-5 nutzt dieses Feld |
| 20 | Duplikat-Warnung (gleicher Projekt + Datum) | ❌ FAIL | Server gibt `duplikatWarnung: true` zurück, aber `setDuplikatWarnung(true)` wird direkt vor `router.push('/begehungen')` gesetzt — Nutzer verlässt die Seite bevor die Warnung gerendert wird — **BUG-001** |
| 21 | Admin sieht alle Begehungen | ✅ PASS | `GET /api/begehungen`: kein `bearbeiter_id`-Filter für `role === 'admin'` |
| 22 | Mitarbeiter sieht nur eigene Begehungen | ✅ PASS | `.eq('bearbeiter_id', auth.userId)` + RLS-Policy `beg_select_mitarbeiter` |

**Ergebnis: 17/22 voll bestanden, 2 PARTIAL, 1 FAIL (BUG-001), 2 mit Bugs**

---

### Edge Cases

| Edge Case | Status | Notiz |
|-----------|--------|-------|
| Claude extrahiert nichts | ✅ PASS | `hatInhalt`-Check → `leerErgebnis: true` → Toast „Keine Felder erkannt. Bitte Felder manuell ausfüllen." |
| API-Timeout bei Extraktion | ✅ PASS | try/catch → `{ error: 'KI-Extraktion fehlgeschlagen...' }` mit 503; Frontend zeigt Toast-Fehler |
| Freitext zu kurz (< 10 Zeichen) | ✅ PASS | Server: `z.string().min(10)` → 422; Client: Button disabled bei `< 10 Zeichen` |
| Duplikat-Begehung (gleicher Projekt + Datum) | ❌ FAIL | Warnung wird nie angezeigt — **BUG-001** |
| Verlassen ohne Speichern | ✅ PASS | `beforeunload`-Event aktiv wenn `hatAenderungen === true` |
| Begehung in Bericht enthalten | ⚠️ PARTIAL | Warnung-Komponente vorhanden (`inBerichtWarnung`), aber Flag ist auf `false` gesetzt (`setInBerichtWarnung(false)`) — Platzhalter bis PROJ-5 |
| Neues Projekt ohne Adresse (Wetterabruf) | ✅ PASS | Button deaktiviert wenn `!selectedProjekt?.adresse && !(selectedProjekt?.lat && selectedProjekt?.lon)` |
| Archiviertes Projekt für Begehung | ✅ PASS | Server prüft `archived_at`; gibt 422 mit „archiviert"-Meldung zurück |

---

### Security Audit (Red-Team)

| Prüfpunkt | Status | Details |
|-----------|--------|---------|
| Authentifizierung auf allen API-Routen | ✅ PASS | `requireAuth()` als erste Aktion in allen Handlern (GET, POST, PUT, DELETE, extract, wetter) |
| IDOR: Mitarbeiter liest fremde Begehung | ✅ PASS | `GET /api/begehungen/[id]`: prüft `bearbeiter.id !== auth.userId` → 403 |
| IDOR: Mitarbeiter ändert fremde Begehung | ✅ PASS | `PUT /api/begehungen/[id]`: prüft `ex.bearbeiter_id !== auth.userId` → 403 |
| IDOR: Mitarbeiter löscht fremde Begehung | ✅ PASS | `DELETE /api/begehungen/[id]`: prüft `ex.bearbeiter_id !== auth.userId` → 403 |
| API-Key nie im Browser sichtbar | ✅ PASS | `ANTHROPIC_API_KEY` nur in `extract/route.ts` (server-seitig); Bright Sky + Nominatim ohne Key |
| Zod-Validierung aller Inputs | ✅ PASS | `BegehungSchema` / `BegehungUpdateSchema` / `RequestSchema` in allen Routes |
| SQL Injection | ✅ PASS | Supabase parametrisiert intern; kein Raw SQL |
| XSS via Textarea-Inputs | ✅ PASS | Daten werden in DB gespeichert und in React-State angezeigt (kein `dangerouslySetInnerHTML`) |
| RLS-Policies vorhanden | ✅ PASS | Migration `003_begehungen.sql`: SELECT/INSERT/UPDATE/DELETE für `begehungen` + `begehung_teilnehmer` |
| Rate Limiting auf Claude-API-Endpunkt | ✅ PASS | Sliding-Window: 20 Extraktionen/Stunde/Nutzer; 429 mit `Retry-After: 3600` bei Überschreitung — **BUG-005 behoben** |
| Fehlende Längenbeschränkungen (DoS-Risiko) | ⚠️ WARN | `BegehungSchema`: Textfelder (`leistungsstand`, `vorkommnisse` etc.) haben kein `z.string().max()` — großer Payload möglich — **BUG-003** |
| PUT erlaubt archiviertes Projekt via API | ⚠️ WARN | `PUT /api/begehungen/[id]` akzeptiert `projekt_id`-Änderung ohne Archivierungs-Check (nur via direktem API-Call exploit bar) — **BUG-004** |
| Middleware leitet API-Routen zu HTML-Login um | ⚠️ WARN | Unauthentifizierte Anfragen an `/api/begehungen*` erhalten 302-Redirect zu `/login` (HTML) statt 401 JSON — für Browser-Clients korrekt, für API-Clients suboptimal |

---

### Bugs

| ID | Severity | Titel | Schritte | Datei |
|----|----------|-------|----------|-------|
| BUG-001 | **High** | Duplikat-Warnung wird nie angezeigt | 1. Neue Begehung für Projekt P am Datum D anlegen. 2. Zweite Begehung für dasselbe Projekt P am selben Datum D speichern. 3. API gibt `duplikatWarnung: true` zurück — aber `router.push('/begehungen')` wird direkt danach aufgerufen, Seite verlassen vor Render. | `BegehungsFormular.tsx:327–344` |
| BUG-002 | **Medium** | Autosave-Wiederherstellung funktioniert nicht im Bearbeiten-Modus | 1. Begehung B bearbeiten unter `/begehungen/[id]/bearbeiten`. 2. Felder ändern (Autosave schreibt alle 60 Sek. nach localStorage). 3. Tab schließen und wieder öffnen. 4. Formular zeigt Server-Stand, nicht den localStorage-Entwurf. | `BegehungsFormular.tsx:72–99` |
| BUG-003 | **Medium** | Fehlende Längenbeschränkungen für Textfelder in API-Schemas | Authentifizierter Nutzer sendet extrem langen Text (~10 MB) an `POST /api/begehungen`. Kein `max()`-Limit in `BegehungSchema`. | `route.ts:22–28`, `[id]/route.ts:19–28` |
| BUG-004 | **Medium** | PUT erlaubt Zuordnung zu archiviertem Projekt via API | Direkter `PUT /api/begehungen/[id]`-Aufruf mit `projekt_id` eines archivierten Projekts. Server akzeptiert es ohne Archivierungs-Check. | `[id]/route.ts:92–158` |
| ~~BUG-005~~ | ~~Critical~~ | ~~Kein Rate Limiting auf `/api/begehungen/extract`~~ | **Behoben 2026-04-25:** Sliding-Window 20/Stunde/Nutzer in `extract/route.ts`; 429 + `Retry-After`-Header; Frontend-Toast für 429. | `extract/route.ts` |
| BUG-006 | **Low** | Irreführender Hint-Text beim Wetterdaten-Button | Button-Hint sagt „Projekt mit Adresse … erforderlich" — Button wird aber auch aktiv wenn nur lat/lon-Koordinaten gesetzt sind (ohne Adresse). | `BegehungsFormular.tsx:469–473` |

---

### Test-Abdeckung

- **Unit-Tests:** 54/54 bestanden (`npm test`)
  - Neu hinzugefügt: `[id]/route.test.ts` (14 Tests: GET/PUT/DELETE Autorisierung)
  - Neu hinzugefügt: `extract/route.test.ts` (9 Tests: Auth, Rate Limiting, Validierung, Claude-Antwortverarbeitung)
- **E2E-Tests:** 7/25 bestanden, 18 skipped (erfordern Live-DB-Session mit echtem Supabase)
  - Datei: `tests/PROJ-3-begehungs-erfassung.spec.ts`
  - Testbare ACs ohne DB: Redirect, Formularstruktur, KI-Extraktion (gemockt), Sicherheitsheader
  - Skipped ACs: Alle Flows die Auth erfordern (Listenansicht, Speichern, CRUD)

---

### Produktionsreife-Entscheidung

**❌ NICHT BEREIT** — 1 High Bug offen (BUG-005 Critical wurde behoben):

- ~~**BUG-005 (Critical):** behoben — Rate Limiting implementiert~~
- **BUG-001 (High):** Duplikat-Warnung wird dem Nutzer nie angezeigt → wichtige UX-Funktion kaputt

**Verbleibende Reihenfolge:**
1. BUG-001 (High): Duplikat-Warnung als Toast anzeigen ODER nicht redirecten
2. BUG-003 (Medium): `max()`-Limits auf Textfelder
3. BUG-004 (Medium): Archivierungs-Check in PUT
4. BUG-002 (Medium): Autosave-Wiederherstellung für Bearbeiten-Modus
5. BUG-006 (Low): Hint-Text korrigieren

## Deployment
_To be added by /deploy_
