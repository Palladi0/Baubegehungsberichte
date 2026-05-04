-- PROJ-12: Erweiterte Berichtsvorlagen

CREATE TABLE berichts_vorlagen (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  ist_standard    BOOLEAN NOT NULL DEFAULT FALSE,
  logo_pfad       TEXT,
  firmenname      TEXT NOT NULL DEFAULT '',
  primaerfarbe    TEXT NOT NULL DEFAULT '#1a1a1a',
  sekundaerfarbe  TEXT NOT NULL DEFAULT '#374151',
  kopfzeilen_text TEXT NOT NULL DEFAULT '',
  fusszeilen_text TEXT NOT NULL DEFAULT '',
  schriftgroesse  TEXT NOT NULL DEFAULT 'mittel' CHECK (schriftgroesse IN ('klein', 'mittel', 'gross')),
  erstellt_am     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  geaendert_am    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE berichts_vorlagen ENABLE ROW LEVEL SECURITY;

-- Alle authentifizierten Nutzer können Vorlagen lesen (für Template-Picker im Editor)
CREATE POLICY "Authentifizierte lesen Vorlagen" ON berichts_vorlagen
  FOR SELECT USING (auth.role() = 'authenticated');

-- Service-Rolle hat vollen Zugriff (für API-Routes)
CREATE POLICY "Service-Rolle Vollzugriff Vorlagen" ON berichts_vorlagen
  FOR ALL USING (auth.role() = 'service_role');

-- vorlage_id in berichte: nullable FK, kein ON DELETE CASCADE
ALTER TABLE berichte
  ADD COLUMN vorlage_id UUID REFERENCES berichts_vorlagen(id) ON DELETE SET NULL;

CREATE INDEX idx_berichte_vorlage_id ON berichte(vorlage_id) WHERE vorlage_id IS NOT NULL;
CREATE INDEX idx_berichts_vorlagen_standard ON berichts_vorlagen(ist_standard) WHERE ist_standard = TRUE;

-- 2 Default-Templates (feste UUIDs für Reproduzierbarkeit)
INSERT INTO berichts_vorlagen (id, name, ist_standard, firmenname, primaerfarbe, sekundaerfarbe, kopfzeilen_text, fusszeilen_text, schriftgroesse)
VALUES
  ('00000000-0000-0000-0001-000000000001',
   'Professionell', TRUE, '',
   '#1a1a1a', '#374151',
   'Baustellenbegehungsbericht',
   'Vertraulich – Nur für den internen Gebrauch',
   'mittel'),
  ('00000000-0000-0000-0001-000000000002',
   'Modern', FALSE, '',
   '#1e40af', '#7c3aed',
   'Baustellenbegehungsbericht',
   'Erstellt mit Baubegehungsberichte',
   'mittel');
