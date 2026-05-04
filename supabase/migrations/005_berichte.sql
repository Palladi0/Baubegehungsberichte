-- Migration 005: Berichtsgenerierung
-- Tabellen: einstellungen, berichte, berichts_versionen

-- Firmenweit geteilte Einstellungen (Logo, Firmendaten)
CREATE TABLE einstellungen (
  schluessel   text PRIMARY KEY,
  wert         text NOT NULL,
  beschreibung text,
  aktualisiert_am timestamptz NOT NULL DEFAULT now()
);

-- Seed: Pflicht-Einstellungen
INSERT INTO einstellungen (schluessel, wert, beschreibung) VALUES
  ('firmenname',    '[Firmenname]',      'Name des Architekturbüros'),
  ('firmenlogo_url','',                  'URL zum Firmenlogo (leer = Platzhalter)');

-- Trigger: aktualisiert_am
CREATE TRIGGER einstellungen_aktualisiert_am
  BEFORE UPDATE ON einstellungen
  FOR EACH ROW EXECUTE FUNCTION set_aktualisiert_am();

-- RLS: Alle authentifizierten Nutzer dürfen lesen; nur Admins dürfen schreiben
ALTER TABLE einstellungen ENABLE ROW LEVEL SECURITY;

CREATE POLICY einst_select ON einstellungen
  FOR SELECT TO authenticated USING (true);

CREATE POLICY einst_update ON einstellungen
  FOR UPDATE TO authenticated USING (auth_rolle() = 'admin');

-- ---------------------------------------------------------------
-- berichte: Ein Datensatz pro Bericht (Projekt + Datum)
-- ---------------------------------------------------------------
CREATE TABLE berichte (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  projekt_id           uuid        NOT NULL REFERENCES projekte(id) ON DELETE CASCADE,
  ersteller_id         uuid        NOT NULL REFERENCES nutzer_profile(id) ON DELETE CASCADE,
  begehungs_datum      date        NOT NULL,
  aktuelle_version_nr  integer     NOT NULL DEFAULT 1,
  erstellt_am          timestamptz NOT NULL DEFAULT now(),
  aktualisiert_am      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (projekt_id, begehungs_datum)
);

CREATE INDEX ON berichte(projekt_id);
CREATE INDEX ON berichte(ersteller_id);
CREATE INDEX ON berichte(begehungs_datum DESC);

CREATE TRIGGER berichte_aktualisiert_am
  BEFORE UPDATE ON berichte
  FOR EACH ROW EXECUTE FUNCTION set_aktualisiert_am();

ALTER TABLE berichte ENABLE ROW LEVEL SECURITY;

-- Admin sieht alle Berichte
CREATE POLICY ber_select_admin ON berichte
  FOR SELECT TO authenticated USING (auth_rolle() = 'admin');

-- Mitarbeiter sehen nur Berichte ihrer Projekte
CREATE POLICY ber_select_mitarbeiter ON berichte
  FOR SELECT TO authenticated
  USING (
    auth_rolle() = 'mitarbeiter'
    AND EXISTS (
      SELECT 1 FROM projekt_mitarbeiter pm
      WHERE pm.projekt_id = berichte.projekt_id AND pm.nutzer_id = auth.uid()
    )
  );

CREATE POLICY ber_insert ON berichte
  FOR INSERT TO authenticated
  WITH CHECK (ersteller_id = auth.uid() OR auth_rolle() = 'admin');

CREATE POLICY ber_update ON berichte
  FOR UPDATE TO authenticated
  USING (ersteller_id = auth.uid() OR auth_rolle() = 'admin');

CREATE POLICY ber_delete ON berichte
  FOR DELETE TO authenticated
  USING (auth_rolle() = 'admin');

-- ---------------------------------------------------------------
-- berichts_versionen: Unveränderliche Snapshots
-- ---------------------------------------------------------------
CREATE TABLE berichts_versionen (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  bericht_id  uuid        NOT NULL REFERENCES berichte(id) ON DELETE CASCADE,
  version_nr  integer     NOT NULL,
  erstellt_am timestamptz NOT NULL DEFAULT now(),
  inhalt      jsonb       NOT NULL,
  UNIQUE (bericht_id, version_nr)
);

CREATE INDEX ON berichts_versionen(bericht_id);
CREATE INDEX ON berichts_versionen(bericht_id, version_nr DESC);

ALTER TABLE berichts_versionen ENABLE ROW LEVEL SECURITY;

-- Zugriff auf Versionen = Zugriff auf den Bericht
CREATE POLICY bver_select ON berichts_versionen
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM berichte b
      WHERE b.id = bericht_id
        AND (
          auth_rolle() = 'admin'
          OR EXISTS (
            SELECT 1 FROM projekt_mitarbeiter pm
            WHERE pm.projekt_id = b.projekt_id AND pm.nutzer_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY bver_insert ON berichts_versionen
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM berichte b
      WHERE b.id = bericht_id
        AND (b.ersteller_id = auth.uid() OR auth_rolle() = 'admin')
    )
  );
