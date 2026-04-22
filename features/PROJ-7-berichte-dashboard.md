# PROJ-7: Berichte-Dashboard

## Status: Architected
**Created:** 2026-04-21
**Last Updated:** 2026-04-22

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

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
