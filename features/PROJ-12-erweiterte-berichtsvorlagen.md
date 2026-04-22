# PROJ-12: Erweiterte Berichtsvorlagen

## Status: Architected
**Created:** 2026-04-21
**Last Updated:** 2026-04-21

## Dependencies
- Requires: PROJ-5 (Berichtsgenerierung) — Basis-Bericht muss existieren
- Requires: PROJ-6 (PDF-Export) — Templates wirken sich auf den PDF-Output aus

## Beschreibung
Admins können das Layout und Design der Berichte an das Corporate Design des Architekturbüros anpassen: Firmenlogo, Farbschema, Schriftarten, Kopf- und Fußzeilen-Inhalt. Mehrere Templates können angelegt und pro Projekt oder Berichtstyp zugewiesen werden. Ermöglicht professionelle, markengerechte Berichte ohne Code-Änderungen.

## User Stories
- Als **Admin** möchte ich das Firmenlogo in alle Berichte einbinden, damit Berichte unsere Corporate Identity widerspiegeln.
- Als **Admin** möchte ich Primär- und Sekundärfarben konfigurieren (z. B. für Überschriften), damit die Berichte visuell zu unserem Büro passen.
- Als **Admin** möchte ich mehrere Berichtsvorlagen anlegen (z. B. eine für Auftraggeber, eine für interne Zwecke), damit unterschiedliche Zielgruppen unterschiedliche Layouts erhalten.
- Als **Mitarbeiter** möchte ich beim Berichtsexport eine Vorlage auswählen, damit ich je nach Empfänger das passende Layout wählen kann.

## Acceptance Criteria
- [ ] Admin-Bereich: Template-Verwaltung (Anlegen, Bearbeiten, Löschen, Als Standard markieren)
- [ ] Konfigurierbare Elemente pro Template: Logo (PNG/SVG, max 2 MB), Firmenname, Primärfarbe (HEX), Sekundärfarbe (HEX), Kopfzeilen-Text, Fußzeilen-Text, Schriftgröße (klein/mittel/groß)
- [ ] Vorschau des Templates in Echtzeit (HTML-Rendering im Admin-UI)
- [ ] Standard-Template wird für alle neuen Berichte verwendet, außer ein Mitarbeiter wählt explizit ein anderes
- [ ] Template-Wechsel im Bericht-Editor möglich, ohne Inhalte zu verlieren
- [ ] Mindestens 2 mitgelieferte Default-Templates: „Professionell" (schlicht, schwarz-weiß) und „Modern" (mit Farbakzenten)
- [ ] Template-Änderungen wirken sich auf zukünftige Exports aus; bestehende PDFs bleiben unverändert

## Edge Cases
- Was passiert, wenn ein Template gelöscht wird, das noch Berichten zugeordnet ist? → Löschen wird verhindert mit Hinweis: „Dieses Template wird von X Berichten verwendet."
- Was passiert, wenn ein Logo-Bild zu groß für die Kopfzeile ist? → Automatische Skalierung auf max. 150px Höhe; Seitenverhältnis bleibt erhalten.
- Was passiert, wenn eine HEX-Farbe zu wenig Kontrast für lesbaren Text bietet? → Warnung im Admin-UI: „Dieser Farbwert könnte die Lesbarkeit beeinträchtigen." (kein Blockieren)

## Technical Requirements
- Templates werden in der Datenbank gespeichert (JSON-Konfiguration + Logo als Dateipfad)
- CSS-Variable-Injection: Template-Farben und Fonts werden als CSS-Variablen in die HTML-Vorlage injiziert
- Logo-Dateien: Gespeichert unter `/var/uploads/templates/[template-id]/logo.[ext]`
- API-Endpunkte: GET /templates, POST /templates, PUT /templates/:id, DELETE /templates/:id

---

## Tech Design (Solution Architect)

### Gewählter Ansatz: CSS-Variable-Injection in bestehende PROJ-5/PROJ-6-Pipeline

PROJ-5 rendert HTML-Berichte serverseitig; PROJ-6 konvertiert dieses HTML via Puppeteer zu PDF. PROJ-12 erweitert diese Pipeline: statt einer fixen Firmenlogo-Einstellung gibt es künftig **mehrere benannte Templates** in der Datenbank. Das gewählte Template wird als CSS Custom Properties (Variablen) serverseitig in das `<head>`-Tag injiziert — PROJ-5 und PROJ-6 bleiben strukturell unverändert, nur die Variablen wechseln.

---

### Komponentenstruktur

```
/admin/vorlagen                        (Admin-Bereich — nur für Admin-Rolle)
+-- VorlagenListe
    +-- VorlagenKarte (pro Template)
    |   +-- VorschauThumbnail          (Miniatur-Rendering des Templates)
    |   +-- Template-Name + StandardBadge
    |   +-- AktionenMenu               (shadcn/ui DropdownMenu)
    |       +-- BearbeitenOption
    |       +-- AlsStandardMarkierenOption
    |       +-- LöschenOption          (blockiert wenn Berichte referenzieren)
    +-- NeueVorlageButton              (shadcn/ui Button)

/admin/vorlagen/neu
/admin/vorlagen/[id]/bearbeiten
+-- VorlagenEditor                     (zweispaltig: Links Form, Rechts Vorschau)
    +-- LinkeSeite: Konfigurationsformular
    |   +-- LogoUploadBereich          (Drag & Drop, PNG/SVG, max 2 MB)
    |   |   +-- VorschauBild           (aktives Logo, skaliert auf 150px Höhe)
    |   |   +-- DateiEingabe           (shadcn/ui Input, type=file)
    |   +-- FirmennameEingabe          (shadcn/ui Input)
    |   +-- PrimärfarbeFeld            (shadcn/ui Input, type=color + HEX-Text)
    |   |   +-- KontrastWarnung        (shadcn/ui Alert — erscheint bei schlechtem Kontrast)
    |   +-- SekundärfarbeFeld          (shadcn/ui Input, type=color + HEX-Text)
    |   +-- KopfzeilenTextFeld         (shadcn/ui Input)
    |   +-- FußzeilenTextFeld          (shadcn/ui Input)
    |   +-- SchriftgrösseAuswahl       (shadcn/ui RadioGroup: klein / mittel / groß)
    |   +-- SpeichernButton            (shadcn/ui Button)
    |
    +-- RechteSeite: LiveVorschau
        +-- VorschauRahmen             (HTML-iframe mit aktuellem Template-CSS)
        +-- VorschauHinweis            ("Vorschau wird live aktualisiert")

/berichte/[id]                         (Erweiterung des Editors aus PROJ-5)
+-- BerichtsEditorHeader
    +-- VorlagenAuswahl                (shadcn/ui Select — wählt Template für Export)
    +-- PDFExportButton                (aus PROJ-6 — nutzt nun gewähltes Template)
```

---

### Datenmodell

**Neue Tabelle `berichts_vorlagen`** — ein Datensatz pro Template:

| Feld | Typ | Beschreibung |
|---|---|---|
| ID | UUID | Eindeutige Kennung |
| Name | Text | Anzeigename (z. B. „Professionell", „Modern") |
| Ist_Standard | Boolean | Genau ein Template ist Standard; wird automatisch verwendet |
| Logo_Pfad | Text (nullable) | Dateisystempfad: `/var/uploads/templates/[id]/logo.[ext]` |
| Firmenname | Text | Erscheint in Kopfzeile wenn kein Logo vorhanden |
| Primärfarbe | Text | HEX-Farbwert (z. B. `#1a1a2e`) |
| Sekundärfarbe | Text | HEX-Farbwert (z. B. `#e94560`) |
| Kopfzeilen_Text | Text | Freier Text für die Kopfzeile |
| Fußzeilen_Text | Text | Freier Text für die Fußzeile |
| Schriftgröße | Enum | `klein` (10pt) / `mittel` (12pt) / `groß` (14pt) |
| Erstellt_am | Zeitstempel | Automatisch |
| Geändert_am | Zeitstempel | Automatisch bei jeder Änderung |

**Erweiterung Tabelle `berichte`** (aus PROJ-5):

| Neues Feld | Typ | Beschreibung |
|---|---|---|
| `vorlage_id` | UUID (nullable, FK) | Verweist auf `berichts_vorlagen`; wenn leer → Standard-Template wird verwendet |

**Erweiterung JSONB-Snapshot in `berichts_versionen`** (aus PROJ-5):

Der bestehende Snapshot wird um einen `vorlage_snapshot`-Block erweitert:

```
{
  vorlage_snapshot: {
    name, logo_pfad, firmenname, primärfarbe,
    sekundärfarbe, kopfzeilen_text, fußzeilen_text, schriftgröße
  },
  deckblatt: { ... },
  abschnitte: [ ... ]
}
```

> **Warum ein Template-Snapshot?** Wenn ein Template nachträglich geändert wird, sehen bereits exportierte PDFs trotzdem noch gleich aus — die Template-Konfiguration zum Export-Zeitpunkt ist eingefroren. Konsistent mit der Snapshot-Philosophie aus PROJ-5.

---

### API-Endpunkte

| Methode | Pfad | Zweck |
|---|---|---|
| `GET` | `/api/templates` | Alle Templates laden (für Auswahl im Editor) |
| `POST` | `/api/templates` | Neues Template anlegen |
| `PUT` | `/api/templates/[id]` | Template-Konfiguration aktualisieren |
| `DELETE` | `/api/templates/[id]` | Template löschen (blockiert wenn Berichte referenzieren) |
| `POST` | `/api/templates/[id]/logo` | Logo-Datei hochladen; ersetzt vorhandenes Logo |
| `PUT` | `/api/templates/[id]/default` | Dieses Template als Standard markieren (alle anderen: `false`) |

**Erweiterung bestehender Endpunkte (PROJ-5 / PROJ-6):**

| Methode | Pfad | Änderung |
|---|---|---|
| `GET` | `/api/reports/[id]/preview` | Liest `vorlage_id` aus `berichte`, injiziert CSS-Variablen des Templates in HTML |
| `POST` | `/api/reports/[id]/export` | Liest Template aus `vorlage_id`, schreibt `vorlage_snapshot` in JSONB-Snapshot |

---

### Technische Entscheidungen

| Entscheidung | Gewählt | Warum |
|---|---|---|
| CSS-Integration | CSS Custom Properties serverseitig in `<head>` injiziert | PROJ-5 und PROJ-6 bleiben strukturell unverändert; nur die Variablen wechseln; Puppeteer rendert sie identisch zum Browser |
| Template-Speicherung | JSONB-Konfiguration in DB + Logo als Datei auf Dateisystem | Konsistent mit PROJ-4 (lokales Dateisystem, DSGVO-konform); kein Cloud-Lock-in |
| Default-Template-Logik | DB-Flag `ist_standard` — genau ein Eintrag `true`, alle anderen `false` | Atomare Umschaltung; kein Race-Condition-Risiko |
| Lösch-Schutz | COUNT-Abfrage auf `berichte.vorlage_id` vor dem Löschen | Verhindert verwaiste Referenzen; klare Fehlermeldung mit Anzahl betroffener Berichte |
| Farbkontrast-Prüfung | WCAG-Luminanz-Berechnung serverseitig (keine externe Library) | Reine Mathematik auf HEX-Wert; warnt, blockiert aber nicht |
| LiveVorschau im Editor | HTML-`<iframe>` wird bei Formularänderungen live aktualisiert | Sofortiges Feedback ohne Page-Reload; iframe isoliert Template-CSS von Admin-UI |
| 2 Default-Templates | Als Datenbankmigrierung geseedete Einträge (nicht hartcodiert) | Können durch Admin angepasst werden; sind normale `berichts_vorlagen`-Einträge |
| Logo-Skalierung | CSS `max-height: 150px; width: auto` im Print-Stylesheet | Browser-Standard; kein serverseitiges Bildprocessing; Seitenverhältnis automatisch erhalten |

---

### Paketabhängigkeiten

Keine neuen Pakete erforderlich — alle benötigten Funktionen sind bereits vorhanden:

| Verfügbar | Woher |
|---|---|
| Datei-Upload | PROJ-4 (Medien-Verwaltung) hat Upload-Logik bereits |
| CSS-Variablen-Injection | PROJ-5 HTML-Renderer (serverseitig) |
| PDF-Rendering | PROJ-6 Puppeteer-Pipeline |
| UI-Komponenten | shadcn/ui (alle bereits installiert) |

---

### Ablaufdiagramm: Template-Auswahl beim PDF-Export

```
Mitarbeiter öffnet Bericht
         ↓
Wählt Template in BerichtsEditorHeader (oder: Standard-Template greift)
         ↓
Klickt PDF-Export (PROJ-6)
         ↓
Server liest vorlage_id aus berichte-Tabelle
         ↓
Server lädt Template-Konfiguration aus berichts_vorlagen
         ↓
Injiziert CSS-Variablen in HTML-Vorschau (PROJ-5 Renderer)
         ↓
Puppeteer rendert HTML → PDF (PROJ-6 Pipeline)
         ↓
vorlage_snapshot wird im JSONB-Snapshot eingefroren
         ↓
PDF steht zum Download bereit
```

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
