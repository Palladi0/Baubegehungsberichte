# PROJ-7: Berichte-Dashboard

## Status: In Review
**Created:** 2026-04-21
**Last Updated:** 2026-04-27

## Dependencies
- Requires: PROJ-1 (Authentifizierung)
- Requires: PROJ-5 (Berichtsgenerierung) — Berichte müssen existieren
- Requires: PROJ-6 (PDF-Export) — PDFs müssen abrufbar sein

## Beschreibung
Zentrales Dashboard für die Verwaltung aller generierten Berichte. Mitarbeiter und Admins sehen eine gefilterte Liste aller Berichte (nach Projekt, Datum, Status). Von hier aus können Berichte geöffnet, bearbeitet, als PDF heruntergeladen oder gelöscht werden. Admins sehen alle Berichte des Büros; Mitarbeiter nur Berichte ihrer Projekte.

## User Stories
- Als **Mitarbeiter** möchte ich auf der Startseite nach dem Login eine Übersicht der letzten Berichte sehen, damit ich schnell den aktuellen Stand finde.
- Als **Mitarbeiter** möchte ich Berichte nach Projekt und Datum filtern, damit ich schnell einen bestimmten Bericht finde.
- Als **Mitarbeiter** möchte ich einen Bericht direkt aus der Liste herunterladen, ohne ihn erst öffnen zu müssen.
- Als **Admin** möchte ich Berichte löschen können, damit veraltete oder fehlerhafte Berichte entfernt werden.
- Als **Mitarbeiter** möchte ich den Status eines Berichts sehen (Entwurf / Fertig), damit ich weiß, welche Berichte noch bearbeitet werden müssen.

## Acceptance Criteria
- [ ] Dashboard ist die Startseite nach dem Login
- [ ] Berichtsliste zeigt: Projektname, Datum, Ersteller, Status (Entwurf/Fertig), Anzahl Fotos, Erstellungsdatum
- [ ] Filter: nach Projekt (Dropdown), nach Datumsbereich (Von–Bis), nach Status (Alle/Entwurf/Fertig)
- [ ] Suchfeld: Volltextsuche in Projektname und Berichtsdatum
- [ ] Sortierung: nach Datum (Standard: neueste zuerst), nach Projekt, nach Ersteller
- [ ] Schnellaktionen pro Bericht: „Öffnen", „PDF herunterladen", „Duplizieren", „Löschen"
- [ ] „Neuer Bericht"-Button oben rechts (führt zur Berichtsgenerierung)
- [ ] Berichts-Löschung: Bestätigungsdialog erforderlich; nur Admins oder Eigentümer des Berichts dürfen löschen
- [ ] Statusanzeige: Entwurf (gelb), Fertig (grün) — visuell unterscheidbar
- [ ] Leere Ansicht: Hilfetext wenn keine Berichte vorhanden sind: „Noch keine Berichte. Erstelle deinen ersten Bericht."
- [ ] Paginierung oder Infinite Scroll (max. 25 Einträge pro Seite)

## Edge Cases
- Was passiert, wenn ein Mitarbeiter versucht, den Bericht eines anderen Mitarbeiters zu löschen? → 403-Fehler; nur Admin oder Eigentümer kann löschen.
- Was passiert, wenn ein Bericht gelöscht wird, dessen PDF noch existiert? → PDF wird ebenfalls gelöscht (oder in Papierkorb verschoben, je nach Konfig).
- Was passiert, wenn sehr viele Berichte vorhanden sind (> 1000)? → Paginierung stellt sicher, dass die Seite performant bleibt; Datenbankindizierung nach Datum und Projekt.
- Was passiert, wenn ein Bericht als „Fertig" markiert ist aber erneut bearbeitet wird? → Status wechselt automatisch zurück zu „Entwurf"; Admin wird ggf. informiert.

## Technical Requirements
- API-Endpunkte: GET /reports (mit Filter-Params), DELETE /reports/:id, PATCH /reports/:id/status
- Clientseitiges Caching für die Berichtsliste (kurze TTL: 30 Sekunden)
- Bulk-Aktionen (P2): Mehrere Berichte gleichzeitig löschen oder exportieren
- Responsive: Dashboard muss auf Tablets funktionieren (iPads auf der Baustelle)

---

## Tech Design (Solution Architect)

### Gewählter Ansatz: Server-seitige Filterung + SWR-Caching

Das Dashboard ist die zentrale Schaltzentrale nach dem Login. Es baut vollständig auf den Datenbankstrukturen aus PROJ-5 (`berichte`, `berichts_versionen`) und PROJ-6 (`pdf_pfad`, `pdf_generiert_am`) auf. Filterung und Paginierung werden serverseitig verarbeitet (DB-Indizes auf `begehungs_datum` und `projekt_id`); der Browser cached die aktuelle Abfrage 30 Sekunden lang via SWR. Einzige Datenmodell-Ergänzung: ein `status`-Feld in der `berichte`-Tabelle.

---

### Komponentenstruktur

```
/ (Dashboard — Startseite nach Login, redirect von PROJ-1 Middleware)
+-- DashboardHeader
|   +-- Seitentitel „Berichte"
|   +-- NeuenBerichtButton            (shadcn/ui Button → /berichte/neu aus PROJ-5)
|
+-- FilterLeiste
|   +-- SuchFeld                      (shadcn/ui Input — sucht in Projektname + Datum)
|   +-- ProjektFilter                 (shadcn/ui Select — Admin: alle; Mitarbeiter: eigene)
|   +-- DatumVon / DatumBis           (2× shadcn/ui Input type=date)
|   +-- StatusFilter                  (shadcn/ui Select: Alle / Entwurf / Fertig)
|   +-- FilterZurücksetzenButton      (shadcn/ui Button, variant=ghost)
|
+-- TabellenKopfzeile
|   +-- SortierKlick Datum ↑↓         (Standard: neueste zuerst)
|   +-- SortierKlick Projekt
|   +-- SortierKlick Ersteller
|   +-- EintragsZähler                (z. B. „23 Berichte gefunden")
|
+-- BerichtsTabelle                   (shadcn/ui Table)
|   +-- Spalten: Projekt | Datum | Ersteller | Status | Fotos | Erstellt am | Aktionen
|   +-- BerichtsZeile (pro Bericht)
|   |   +-- ProjektName + -kürzel
|   |   +-- BegehungsDatum            (DD.MM.YYYY)
|   |   +-- ErstellerName
|   |   +-- StatusBadge               (shadcn/ui Badge: Entwurf=gelb / Fertig=grün)
|   |   +-- FotoAnzahl                (Zahl, aus PROJ-4 fotos-Tabelle via Join)
|   |   +-- ErstellungsDatum
|   |   +-- AktionenDropdown          (shadcn/ui DropdownMenu)
|   |       +-- „Öffnen"              (→ /berichte/[id])
|   |       +-- „PDF herunterladen"   (→ GET /api/reports/[id]/download aus PROJ-6;
|   |       |                            deaktiviert + Tooltip wenn kein PDF vorhanden)
|   |       +-- „Duplizieren"         (POST /api/reports/[id]/duplicate)
|   |       +-- Trennlinie
|   |       +-- „Löschen"             (rot; nur Admin oder Eigentümer; öffnet Dialog)
|   |
|   +-- Lade-Skeleton                 (shadcn/ui Skeleton — während Datenabruf)
|
+-- LeerZustand                       (wenn keine Berichte / keine Treffer)
|   +-- Icon + Text „Noch keine Berichte. Erstelle deinen ersten Bericht."
|   +-- NeuenBerichtButton
|
+-- Paginierung                       (shadcn/ui Pagination — 25 Einträge/Seite)
|   +-- Zurück | Seite X von Y | Weiter
|
+-- LöschDialog                       (shadcn/ui AlertDialog — vor Löschung)
    +-- Warnung: „Bericht und zugehöriges PDF werden dauerhaft gelöscht."
    +-- Abbrechen / Löschen bestätigen (rot, destructive)
```

---

### Datenmodell — Ergänzung

Keine neue Tabelle. Die bestehende **`berichte`-Tabelle** (PROJ-5) erhält ein weiteres Feld:

| Neues Feld | Typ | Beschreibung |
|---|---|---|
| `status` | Enum: `entwurf` \| `fertig` | Standard: `entwurf` bei Erstellung; wechselt automatisch auf `entwurf` zurück, wenn eine neue Version gespeichert wird |

Die **Foto-Anzahl** pro Bericht kommt aus einem Join mit der `fotos`-Tabelle (PROJ-4) — kein neues Feld, kein Denormalisieren.

---

### API-Endpunkte

| Methode | Pfad | Zweck |
|---|---|---|
| `GET` | `/api/reports` | Gefilterte, paginierte Berichtsliste |
| `DELETE` | `/api/reports/[id]` | Bericht + PDF löschen (Auth-Check: Admin oder Eigentümer) |
| `PATCH` | `/api/reports/[id]/status` | Status zwischen `entwurf` und `fertig` umschalten |
| `POST` | `/api/reports/[id]/duplicate` | Bericht duplizieren (neuer Eintrag, Status = `entwurf`) |

**GET /api/reports — Query-Parameter:**

| Parameter | Typ | Beschreibung |
|---|---|---|
| `projekt_id` | UUID (optional) | Filter auf ein Projekt |
| `von` | Datum (optional) | Begehungsdatum ab … |
| `bis` | Datum (optional) | Begehungsdatum bis … |
| `status` | `entwurf\|fertig` (optional) | Statusfilter |
| `suche` | String (optional) | Volltextsuche im Projektnamen |
| `seite` | Integer (default: 1) | Aktuelle Seite (25 Einträge/Seite) |
| `sortierung` | `datum_desc\|datum_asc\|projekt\|ersteller` | Sortierfeld |

**Autorisierungs-Logik (serverseitig):**
- **Admin:** sieht alle Berichte aller Projekte
- **Mitarbeiter:** sieht nur Berichte, bei denen er Ersteller ist oder dem Projekt zugeordnet ist (Projektmitgliedschaft aus PROJ-2)

---

### Technische Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Datenabruf | SWR mit 30-Sekunden-Revalidierung | Spec fordert clientseitiges Caching mit kurzer TTL; SWR zeigt beim Re-Fokus auf den Tab sofort aktuelle Daten |
| Filter-Verarbeitung | Serverseitig (Query-Parameter an API) | Bei >1000 Berichten darf nicht alles geladen werden; DB-Indizes auf `begehungs_datum` und `projekt_id` halten Abfragen schnell |
| Pagination | Seitenbasiert (OFFSET) | Einfache UX; bei den erwarteten Datenmengen (<10.000 Berichte) kein Performance-Problem |
| Rollenprüfung | Supabase RLS + API-Layer | RLS verhindert, dass Mitarbeiter fremde Berichte über direkte DB-Zugriffe sehen; API liefert verständliche 403-Fehler |
| Lösch-Logik | API löscht DB-Zeile + PDF-Datei aus Dateisystem | Konsistent mit PROJ-6 (`pdf_pfad`); kein verwaister Datei-Müll auf dem Server |
| Duplizieren | Neuer `berichte`-Eintrag mit Status `entwurf`, ohne Versionshistorie | Sauberer Start; keine verwirrenden alten Versionen im Duplikat |
| Tablet-Responsiveness | Table → Card-Layout unter md-Breakpoint (768 px) | iPads auf der Baustelle haben ~768 px; Tabellenspalten werden zu gestapelten Karten |

---

### Abhängigkeiten & neue Pakete

| Paket | Verwendung | Status |
|---|---|---|
| `swr` | Client-seitiges Caching der Berichtsliste | Neu installieren |
| shadcn/ui: Table, Badge, Select, Input, DropdownMenu, AlertDialog, Skeleton, Pagination | UI-Komponenten | Bereits vorhanden |
| Supabase Client | Datenbankabfragen, RLS | Bereits vorhanden |

## Implementation Notes
- Alle API-Endpunkte (GET /api/reports, DELETE /api/reports/[id], PATCH /api/reports/[id]/status, POST /api/reports/[id]/duplicate) implementiert
- Frontend-Komponenten: BerichteDashboard, BerichteTabelle, FilterLeiste, AktionenDropdown, LöschDialog
- SWR-Caching mit 30-Sekunden-Revalidierung aktiv
- Paginierung (25 Einträge/Seite) serverseitig
- Rollenbasierter Zugriff: Admin sieht alle Berichte, Mitarbeiter nur Projekte bei denen sie Mitglied sind
- Sortierung nach Datum (asc/desc), Projekt-ID, Ersteller-ID
- PDF-Datei wird beim Löschen eines Berichts ebenfalls entfernt (best-effort)
- Homepage (/) leitet authentifizierte Nutzer automatisch zu /berichte weiter

## QA Test Results

**QA Date:** 2026-04-27
**Tester:** /qa skill
**Status:** ❌ NOT READY — 1 High (Security) + 2 Medium + 3 Low bugs found

---

### Acceptance Criteria Results

| # | Criteria | Result | Notes |
|---|----------|--------|-------|
| AC-1 | Dashboard ist Startseite nach Login | ✅ PASS | `page.tsx` redirect zu `/berichte`, Middleware schützt Route |
| AC-2 | Berichtsliste zeigt Projekt, Datum, Ersteller, Status, Fotos, Erstellt | ✅ PASS | Alle Pflichtfelder in `BerichteTabelle.tsx` vorhanden |
| AC-3 | Filter: Projekt, Datumsbereich, Status | ✅ PASS | `FilterLeiste.tsx` hat alle drei Filter |
| AC-4 | Suchfeld: Volltextsuche in Projektname und Berichtsdatum | ❌ FAIL | **BUG-2**: Suche durchsucht nur Projektnamen, nicht Datum |
| AC-5 | Sortierung: Datum (Standard), Projekt, Ersteller | ⚠️ PARTIAL | Optionen vorhanden, aber **BUG-6**: Projekt-Sortierung nutzt UUID statt Name |
| AC-6 | Schnellaktionen: Öffnen, PDF herunterladen, Duplizieren, Löschen | ⚠️ PARTIAL | **BUG-5**: PDF-Download versteckt statt deaktiviert+Tooltip wenn kein PDF |
| AC-7 | „Neuer Bericht"-Button oben rechts → /berichte/neu | ✅ PASS | |
| AC-8 | Löschung: Bestätigungsdialog, nur Admin/Eigentümer | ✅ PASS | `LöschDialog.tsx` + API-Check korrekt |
| AC-9 | Statusanzeige: Entwurf (gelb), Fertig (grün) | ✅ PASS | `StatusBadge` mit korrekten Tailwind-Klassen |
| AC-10 | Leere Ansicht mit Hilfetext | ⚠️ PARTIAL | **BUG-4**: Kein Unterschied zwischen „keine Berichte" vs. „kein Treffer für Filter" |
| AC-11 | Paginierung (max. 25 Einträge/Seite) | ⚠️ PARTIAL | **BUG-3**: Seiten-Buttons zeigen immer Seiten 1–5; Seite 6+ nicht erreichbar |

---

### Bugs Found

#### 🔴 BUG-1 — IDOR: Mitarbeiter kann Berichte fremder Projekte abrufen (High / Security)
**Schweregrad:** High (Security — IDOR / Insecure Direct Object Reference)
**Datei:** `src/app/api/reports/route.ts:84-87`

**Beschreibung:**
Wenn ein Mitarbeiter `?projekt_id=<UUID>` für ein Projekt übergibt, dem er nicht angehört, wird die `erlaubteProjektIds`-Prüfung umgangen. Der Code verzweigt:
```typescript
if (projektId) {
  query = query.eq('projekt_id', projektId)  // ← erlaubteProjektIds wird NICHT geprüft
} else if (effektiveProjektIds !== null) {
  query = query.in('projekt_id', effektiveProjektIds)
}
```
Da `createServiceClient()` RLS umgeht, gibt die API Berichte zurück, obwohl der Nutzer keinen Zugriff hat.

**Voraussetzung:** Nutzer muss Mitglied in mindestens einem Projekt sein (sonst greift der Early-Return bei `erlaubteProjektIds.length === 0`).

**Reproduktion:**
1. Als Mitarbeiter (kein Admin) einloggen, der in Projekt A Mitglied ist
2. GET `/api/reports?projekt_id=<UUID-von-Projekt-B>` (Projekt B, kein Mitglied)
3. → API gibt Berichte von Projekt B zurück (erwartet: leere Liste oder 403)

**Beweis:** Unit-Test `[BUG-1]` in `src/app/api/reports/route.test.ts` schlägt fehl

**Fix:** Vor Anwendung des `projekt_id`-Filters prüfen, ob die angegebene ID in `erlaubteProjektIds` enthalten ist:
```typescript
if (projektId) {
  if (erlaubteProjektIds !== null && !erlaubteProjektIds.includes(projektId)) {
    return NextResponse.json({ berichte: [], gesamt: 0, seiten: 0 })
  }
  query = query.eq('projekt_id', projektId)
}
```

---

#### 🟡 BUG-2 — Suche durchsucht nicht das Datum (Medium)
**Schweregrad:** Medium
**Datei:** `src/app/api/reports/route.ts:41-51`

**Beschreibung:**
Die Spec fordert „Volltextsuche in Projektname und Berichtsdatum". Die Implementierung sucht nur im Projektnamen via `ilike('name', ...)`. Datumssuche ist nicht implementiert.

**Reproduktion:**
1. Im Suchfeld ein Datum eingeben (z. B. „20.04")
2. → Keine Ergebnisse; erwartet: Berichte vom 20.04. werden gefunden

**Fix:** Zusätzlich nach `begehungs_datum` filtern, wenn der Suchterm wie ein Datum aussieht, oder serverseitig einen `OR`-Filter auf `begehungs_datum` ergänzen.

---

#### 🟡 BUG-3 — Paginierung: Seiten 6+ nicht erreichbar (Medium)
**Schweregrad:** Medium
**Datei:** `src/components/berichte/BerichteTabelle.tsx:197-208`

**Beschreibung:**
Die Seiten-Buttons werden so generiert:
```typescript
Array.from({ length: Math.min(seiten, 5) }).map((_, i) => {
  const seiteNr = i + 1  // Immer 1, 2, 3, 4, 5
  ...
})
```
Bei mehr als 5 Seiten (> 125 Berichte) sind Seiten 6+ nicht erreichbar. Der „Weiter"-Button funktioniert zwar, aber ohne direkten Sprung gibt es keine Möglichkeit, weit zu navigieren.

**Fix:** Sliding-Window-Paginierung implementieren, die Seiten rund um die aktuelle Seite anzeigt.

---

#### 🟢 BUG-4 — Leere Ansicht unterscheidet nicht zwischen „keine Berichte" und „kein Treffer" (Low)
**Schweregrad:** Low
**Datei:** `src/components/berichte/BerichteTabelle.tsx:72-84`

**Beschreibung:**
Die Spec fordert für den Fall „keine Berichte vorhanden": „Noch keine Berichte. Erstelle deinen ersten Bericht." mit einem „Neuer Bericht"-Button. Stattdessen zeigt die Implementierung immer „Keine Berichte gefunden" + „Passe die Filter an oder erstelle einen neuen Bericht." — auch wenn gar keine Filter aktiv sind und schlicht noch kein Bericht existiert.

**Fix:** Im `LeerZustand` unterscheiden, ob Filter aktiv sind (`props.istGefiltert`). Bei leerer Datenbank anderen Text + direkten „Neuer Bericht"-Button anzeigen.

---

#### 🟢 BUG-5 — PDF-Download-Aktion versteckt statt deaktiviert (Low)
**Schweregrad:** Low
**Datei:** `src/components/berichte/AktionenDropdown.tsx:113-119`

**Beschreibung:**
Die Spec fordert: „PDF herunterladen"-Aktion „deaktiviert + Tooltip wenn kein PDF vorhanden". Aktuell wird die Aktion vollständig ausgeblendet (`{hatPdf && !pdfVeraltet && (...)}`) und stattdessen „PDF generieren" eingeblendet. Für einen Nutzer, der nicht weiß, ob ein PDF generiert wurde, ist das verwirrend.

**Fix:** Immer „PDF herunterladen" anzeigen; wenn kein PDF vorhanden → `disabled` + `Tooltip` „Noch kein PDF generiert".

---

#### 🟢 BUG-6 — Sortierung „Projekt" nutzt UUID statt Projektname (Low)
**Schweregrad:** Low
**Datei:** `src/app/api/reports/route.ts:108`

**Beschreibung:**
```typescript
case 'projekt':
  query = query.order('projekt_id', { ascending: true })
```
`projekt_id` ist eine UUID. UUID-Sortierung ergibt keine alphabetische Sortierung nach Projektname.

**Fix:** Entweder in der DB via Join nach `projekte.name` sortieren, oder die App-seitige Sortierung nach `projekt_name` im API-Response vornehmen.

---

### Edge Case Tests

| Edge Case | Result | Notes |
|-----------|--------|-------|
| Mitarbeiter löscht fremden Bericht | ✅ PASS | API gibt 403 zurück (korrekt) |
| Admin löscht beliebigen Bericht | ✅ PASS | API gibt 204 zurück |
| Bericht nicht gefunden (DELETE) | ✅ PASS | API gibt 404 zurück |
| Status-Toggle entwurf → fertig → entwurf | ✅ PASS | Korrekte Toggle-Logik |
| Fremder Mitarbeiter ändert Status | ✅ PASS | API gibt 403 zurück |
| 0 Berichte (leere DB) | ⚠️ PARTIAL | Leere Ansicht vorhanden, aber Text nicht spec-konform (BUG-4) |
| > 125 Berichte (> 5 Seiten) | ❌ FAIL | Seiten 6+ nicht erreichbar (BUG-3) |

---

### Security Audit

| Check | Result | Notizen |
|-------|--------|---------|
| Auth-Check auf allen API-Endpunkten | ✅ PASS | `requireAuth()` in allen Routes |
| IDOR: Mitarbeiter sieht fremde Berichte über projekt_id-Param | ❌ FAIL | **BUG-1** — High |
| Lösch-Autorisierung (nur Admin/Eigentümer) | ✅ PASS | Korrekte Prüfung in DELETE-Route |
| XSS: Suche-Input | ✅ PASS | Supabase parametrisierte Queries |
| SQL Injection: Filter-Parameter | ✅ PASS | Supabase SDK, keine Raw Queries |
| Exposed Secrets in API-Response | ✅ PASS | Keine sensiblen Felder exponiert |
| Rate Limiting auf Auth-Endpunkten | ✅ PASS | Middleware-Rate-Limit vorhanden |
| Admin-Routen geschützt | ✅ PASS | Middleware prüft Rolle |
| createServiceClient() bypass RLS | ⚠️ INFO | Service Client umgeht RLS bewusst; App-Layer-Checks müssen zuverlässig sein — BUG-1 zeigt Lücke |

---

### Automated Test Summary

**Unit Tests:** `src/app/api/reports/route.test.ts` — 7 Tests (1 schlägt fehl: BUG-1 bewiesen)
**Unit Tests:** `src/app/api/reports/[id]/route.test.ts` — 5 Tests (alle grün)
**Unit Tests:** `src/app/api/reports/[id]/status/route.test.ts` — 5 Tests (alle grün)
**E2E Tests:** `tests/PROJ-7-berichte-dashboard.spec.ts` — 18 Tests (2 pass: Auth-Redirects; 16 skip: kein Supabase-Session in CI)

---

### Regression Check

Alle vorherigen Test-Suites (PROJ-1 bis PROJ-6): ✅ Kein Fehler — 143 Tests grün (1 absichtlich fehlend für BUG-1 Dokumentation)

---

### Production Readiness

**❌ NOT READY** — 1 High (Security) Bug muss vor Deployment behoben werden.

| Priorität | Bug | Blockiert Deployment? |
|-----------|-----|-----------------------|
| 1 (P0) | BUG-1: IDOR Mitarbeiter sieht fremde Berichte | ✅ JA — muss behoben werden |
| 2 (P1) | BUG-2: Suche durchsucht nicht Datum | Nein |
| 3 (P1) | BUG-3: Paginierung > 5 Seiten defekt | Nein (bei < 126 Berichten kein Problem) |
| 4 (P2) | BUG-4: Leere-Zustand Text nicht spec-konform | Nein |
| 5 (P2) | BUG-5: PDF-Download versteckt statt deaktiviert | Nein |
| 6 (P2) | BUG-6: Projekt-Sortierung falsch (UUID) | Nein |

## Deployment
_To be added by /deploy_
