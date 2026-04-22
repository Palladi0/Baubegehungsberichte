# PROJ-5: Berichtsgenerierung

## Status: Planned
**Created:** 2026-04-21
**Last Updated:** 2026-04-21

## Dependencies
- Requires: PROJ-1 (Authentifizierung)
- Requires: PROJ-2 (Projektverwaltung)
- Requires: PROJ-3 (Begehungs-Erfassung) — Begehungsdaten als Berichtsinhalt
- Requires: PROJ-4 (Medien-Verwaltung) — Fotos als Berichtsinhalt

## Beschreibung
Das Kernstück des Systems: Ein strukturierter, mehrseitiger HTML-Bericht wird dynamisch aus den erfassten Begehungsdaten und Fotos generiert. Der Bericht besteht aus einem Deckblatt mit den wichtigsten Kennzahlen und einem oder mehreren Projektabschnitten mit Fotos und Texten. Die Struktur ist flexibel: Abschnitte können eingefügt, entfernt und umsortiert werden. Täglich wird ein neuer Bericht erstellt, der alle Begehungen des Tages zusammenfasst.

## User Stories
- Als **Mitarbeiter** möchte ich mit einem Klick einen Tagesbericht für ein bestimmtes Datum generieren lassen, damit ich schnell einen druckfertigen Bericht erhalte.
- Als **Mitarbeiter** möchte ich mehrere Begehungen desselben Tages in einem einzigen Bericht zusammenfassen, damit der Auftraggeber eine Gesamtübersicht erhält.
- Als **Mitarbeiter** möchte ich den generierten Bericht in einer Vorschau sehen und Abschnitte verschieben oder entfernen, bevor ich ihn exportiere.
- Als **Admin** möchte ich das Firmenlogo und Briefkopf in den Bericht einbinden, damit der Bericht unsere Corporate Identity widerspiegelt.
- Als **Mitarbeiter** möchte ich einzelne Foto-Abschnitte ein- oder ausblenden, damit nicht alle Fotos im Abgabe-Bericht erscheinen.

## Acceptance Criteria

### Deckblatt (Seite 1):
- [ ] Firmenlogo (konfigurierbar im Admin-Bereich)
- [ ] Berichtstitel: „Baustellenbegehung – [Projektname]"
- [ ] Projektnummer
- [ ] Datum der Begehung
- [ ] Uhrzeit der Begehung
- [ ] Wetterbedingungen + Temperatur
- [ ] Teilnehmer / Beteiligte (Name + Rolle, nummeriert)
- [ ] Erstellungsdatum des Berichts + Ersteller

### Folgeseiten (je Begehung / Themenabschnitt):
- [ ] Abschnittsüberschrift (automatisch oder editierbar)
- [ ] Freitext-Block (Leistungsstand, Vorkommnisse, Maßnahmen)
- [ ] Foto-Galerie: Fotos mit Bildunterschrift (2 Fotos pro Zeile)
- [ ] Abschnitte sind per Drag-and-Drop sortierbar (in der Vorschau)
- [ ] Abschnitte können einzeln ausgeblendet werden (erscheinen nicht im Export)

### Berichtserstellung:
- [ ] Bericht-Generator-Dialog: Datum auswählen + Projekt(e) auswählen → Bericht wird generiert
- [ ] Mehrere Begehungen desselben Tages werden in separate Abschnitte unterteilt
- [ ] Bericht kann manuell bearbeitet werden: Texte editieren, Fotos hinzufügen/entfernen
- [ ] Änderungen werden als neue Version gespeichert (kein Überschreiben; Versionsverlauf)
- [ ] HTML-Vorschau in der Web-App mit WYSIWYG-Qualität
- [ ] Druckansicht entspricht dem späteren PDF-Export (identisches Layout)

## Edge Cases
- Was passiert, wenn an einem Tag keine Begehungen erfasst wurden? → Fehlermeldung: „Für das gewählte Datum und Projekt liegen keine abgeschlossenen Begehungen vor."
- Was passiert, wenn eine Begehung sehr viele Fotos hat (> 50)? → Warnung: „Dieser Abschnitt enthält 50+ Fotos. Das kann den PDF-Export verlangsamen. Möchten Sie Fotos auswählen?"
- Was passiert, wenn der Berichtsabschnitt nach dem Sortieren gespeichert wird und die Begehungsdaten sich nachträglich ändern? → Berichtsversion bleibt unverändert; eine neue Version kann auf Basis der neuen Daten erstellt werden.
- Was passiert, wenn mehrere Begehungen verschiedener Projekte an einem Tag zusammengefasst werden sollen? → Nicht unterstützt (MVP); ein Bericht = ein Projekt. Erweiterung in P2.
- Was passiert bei fehlendem Firmenlogo? → Platzhaltertext „[Firmenname]" wird verwendet.

## Technical Requirements
- HTML-Bericht wird serverseitig gerendert (kein clientseitiges Rendering für PDF-Konsistenz)
- CSS: Print-optimiertes Stylesheet (A4, 2 cm Ränder, serifenlose Schrift)
- Versionierung: Jeder gespeicherte Zustand eines Berichts erhält einen Versions-Timestamp
- API-Endpunkte: POST /reports/generate, GET /reports/:id, PUT /reports/:id, GET /reports/:id/preview

---

## Tech Design (Solution Architect)

### Gewählter Ansatz: Serverseitiges HTML-Rendering + JSONB-Versionierung

Berichte werden **serverseitig** aus den Daten der Tabellen `begehungen` und `fotos` generiert (konsistent mit PROJ-3 und PROJ-4). Jeder gespeicherte Berichtsstand wird als **unveränderlicher JSONB-Snapshot** in Supabase abgelegt — kein Überschreiben, kein Datenverlust. Die Vorschau im Browser nutzt exakt dasselbe CSS wie der spätere PDF-Export (PROJ-6), sodass WYSIWYG garantiert ist.

---

### Komponentenstruktur

```
/berichte/neu  (Bericht-Generator — aufrufbar aus Dashboard PROJ-7)
+-- BerichtsGeneratorDialog          (shadcn/ui Dialog)
    +-- ProjektAuswahl               (shadcn/ui Select — zeigt nur zugeordnete Projekte)
    +-- DatumAuswahl                 (shadcn/ui Input, type=date, Default: heute)
    +-- VerfügbareBegehungenHinweis  (shadcn/ui Alert — „3 Begehungen gefunden" / Fehlermeldung)
    +-- GenerierenButton             (shadcn/ui Button — leitet weiter zu /berichte/[id])

/berichte/[id]  (Berichtseditor / Vorschau)
+-- BerichtsEditorHeader
|   +-- Projekttitel + Begehungsdatum
|   +-- VersionsAnzeige             (z. B. „Version 3 — gespeichert 14:32 Uhr")
|   +-- SpeichernButton             (shadcn/ui Button — speichert neuen Versions-Snapshot)
|   +-- PDFExportButton             (→ PROJ-6, zunächst deaktiviert)
|
+-- BerichtsVorschau                (scrollbarer Bereich, Print-CSS aktiv)
    +-- Deckblatt                   (Seite 1 des Berichts)
    |   +-- FirmenlogoBereich       (Bild aus Admin-Einstellung oder Platzhaltertext)
    |   +-- BerichtsKopf            (Titel „Baustellenbegehung – [Projektname]", Projektnummer)
    |   +-- MetaZeile               (Datum | Uhrzeit | Erstellt von | Erstellungsdatum)
    |   +-- WetterZeile             (Icon + Bedingung + Temperatur)
    |   +-- TeilnehmerListe         (nummerierte Liste: Name + Rolle)
    |
    +-- AbschnittListe              (Drag-and-Drop Container via @dnd-kit)
        +-- BerichtsAbschnitt       (pro Begehung — sortierbar per Drag & Drop)
            +-- AbschnittsHeader
            |   +-- DragHandle      (visueller Anfasser zum Verschieben)
            |   +-- TitelFeld       (shadcn/ui Input — editierbar, auto-befüllt)
            |   +-- SichtbarkeitsToggle  (shadcn/ui Switch — blendet Abschnitt im Export aus)
            +-- FreitextFeld        (shadcn/ui Textarea — Leistungsstand, Vorkommnisse, Maßnahmen)
            +-- FotoGalerie         (2 Spalten, responsive)
                +-- BerichtsFoto    (pro Foto im Abschnitt)
                    +-- ThumbnailBild
                    +-- BildunterschriftFeld  (shadcn/ui Input — editierbar)
                    +-- FotoAusblendenButton  (shadcn/ui Switch — Foto aus Export ausblenden)
```

---

### Datenmodell

**Tabelle `berichte`** — ein Datensatz pro Bericht (Projekt + Datum):

| Feld | Typ | Beschreibung |
|---|---|---|
| ID | UUID | Eindeutige Kennung |
| Projekt-ID | UUID | Fremdschlüssel → `projekte` (PROJ-2) |
| Ersteller-ID | UUID | Fremdschlüssel → `nutzer_profile` (PROJ-1) |
| Begehungs-Datum | Datum | Tag, für den der Bericht gilt |
| Aktuelle Versions-Nr | Integer | Zeigt auf die zuletzt gespeicherte Version |
| Erstellt am | Zeitstempel | Automatisch |
| Zuletzt geändert | Zeitstempel | Automatisch bei Versions-Speicherung |

**Tabelle `berichts_versionen`** — unveränderliche Snapshots jedes Speicherstands:

| Feld | Typ | Beschreibung |
|---|---|---|
| ID | UUID | Eindeutige Kennung |
| Bericht-ID | UUID | Fremdschlüssel → `berichte` |
| Versions-Nr | Integer | 1, 2, 3 … (inkrementell pro Bericht) |
| Erstellt am | Zeitstempel | Zeitpunkt der Speicherung |
| Inhalt | JSONB | Vollständiger Snapshot (Deckblatt + Abschnitte + Fotos, siehe unten) |

**JSONB-Snapshot-Struktur** (Inhalt einer Berichtsversion):
```
{
  deckblatt: {
    firmenlogo_url, projektname, projektnummer,
    datum, uhrzeit, wetter, temperatur,
    teilnehmer: [{ name, rolle }],
    erstellt_am, ersteller_name
  },
  abschnitte: [
    {
      begehungs_id, titel, freitext, sichtbar, reihenfolge,
      fotos: [{ foto_id, thumb_url, display_url, bildunterschrift, sichtbar, reihenfolge }]
    }
  ]
}
```

> **Warum JSONB-Snapshot?** Ändert sich ein Begehungsdatensatz nachträglich, bleiben bereits gespeicherte Berichtsversionen unberührt — keine Datenbankinkonsistenzen, kein versehentliches Überschreiben von Freigaben. Das entspricht exakt der im Spec definierten Anforderung.

---

### API-Endpunkte

| Methode | Pfad | Zweck |
|---|---|---|
| POST | `/api/reports/generate` | Erstellt neuen Bericht aus Begehungen (Datum + Projekt → Version 1) |
| GET | `/api/reports` | Liste aller Berichte (für PROJ-7 Dashboard) |
| GET | `/api/reports/[id]` | Bericht + aktuellste Version laden |
| GET | `/api/reports/[id]/versions` | Alle Versionen eines Berichts auflisten |
| GET | `/api/reports/[id]/versions/[nr]` | Bestimmte Version laden (Versionsverlauf) |
| PUT | `/api/reports/[id]` | Aktuellen Bearbeitungsstand als neue Version speichern |
| GET | `/api/reports/[id]/preview` | Serverseitig gerendertes HTML (für Druck / PROJ-6) |

---

### Technische Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| Rendering-Ort | Serverseitig (Next.js API Route) | PDF-Konsistenz: Browser-Rendering kann font-rendering und Seitenumbrüche nicht zuverlässig steuern; Server liefert identisches HTML für Vorschau und PDF-Export (PROJ-6) |
| Versionierung | JSONB-Snapshot in Supabase | Unveränderliche Versionen ohne FK-Abhängigkeiten; freigegebene Berichte werden nie durch spätere Datenänderungen korrumpiert |
| Drag & Drop | `@dnd-kit/core` + `@dnd-kit/sortable` | Leichtgewichtig, barrierefrei (ARIA), kein jQuery; speziell für React/Next.js konzipiert |
| Print-CSS | Dediziertes `@media print`-Stylesheet | A4-Format, 2 cm Ränder, serifenlose Schrift (wie im Spec gefordert); identisch in Browser-Vorschau und PDF-Export |
| Foto-Auslieferung in Berichten | URLs aus PROJ-4 API (`/api/media/file/[id]`) | Zugriffskontrolle bleibt erhalten; kein direkter Dateisystem-Zugriff im Frontend |
| Firmenlogo-Konfiguration | Admin-Einstellung in Supabase `einstellungen`-Tabelle | Zentraler Speicherort; alle Berichte verwenden automatisch das aktuelle Logo |

---

### Paketabhängigkeiten

| Paket | Zweck |
|---|---|
| `@dnd-kit/core` | Drag-and-Drop-Basisframework |
| `@dnd-kit/sortable` | Sortierbare Listen (Abschnitte per Drag & Drop verschieben) |

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
