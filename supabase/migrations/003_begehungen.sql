-- Migration 003: Begehungs-Erfassung
-- Tabellen: begehungen, begehung_teilnehmer
-- Erweitert projekte um lat/lon für Wetterabruf

ALTER TABLE projekte
  ADD COLUMN IF NOT EXISTS lat  double precision,
  ADD COLUMN IF NOT EXISTS lon  double precision;

CREATE TABLE begehungen (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  projekt_id          uuid        NOT NULL REFERENCES projekte(id) ON DELETE CASCADE,
  bearbeiter_id       uuid        NOT NULL REFERENCES nutzer_profile(id) ON DELETE CASCADE,
  datum               date        NOT NULL,
  uhrzeit             time        NOT NULL,
  wetterbedingungen   text        CHECK (wetterbedingungen IN ('Sonnig','Bewölkt','Regnerisch','Schnee','Nebel')),
  temperatur          numeric(5,1),
  leistungsstand      text,
  vorkommnisse        text,
  massnahmen          text,
  bemerkungen         text,
  status              text        NOT NULL DEFAULT 'Entwurf' CHECK (status IN ('Entwurf','Fertig')),
  erstellt_am         timestamptz NOT NULL DEFAULT now(),
  aktualisiert_am     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE begehung_teilnehmer (
  id              uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  begehung_id     uuid  NOT NULL REFERENCES begehungen(id) ON DELETE CASCADE,
  name            text  NOT NULL,
  rolle           text  NOT NULL DEFAULT ''
);

-- Indexes
CREATE INDEX ON begehungen(projekt_id);
CREATE INDEX ON begehungen(bearbeiter_id);
CREATE INDEX ON begehungen(datum DESC);
CREATE INDEX ON begehungen(status);
CREATE INDEX ON begehung_teilnehmer(begehung_id);

-- Trigger: aktualisiert_am
CREATE TRIGGER begehungen_aktualisiert_am
  BEFORE UPDATE ON begehungen
  FOR EACH ROW EXECUTE FUNCTION set_aktualisiert_am();

-- RLS
ALTER TABLE begehungen          ENABLE ROW LEVEL SECURITY;
ALTER TABLE begehung_teilnehmer ENABLE ROW LEVEL SECURITY;

-- begehungen: Admin sieht alle; Mitarbeiter nur eigene
CREATE POLICY beg_select_admin ON begehungen
  FOR SELECT TO authenticated
  USING (auth_rolle() = 'admin');

CREATE POLICY beg_select_mitarbeiter ON begehungen
  FOR SELECT TO authenticated
  USING (auth_rolle() = 'mitarbeiter' AND bearbeiter_id = auth.uid());

CREATE POLICY beg_insert ON begehungen
  FOR INSERT TO authenticated
  WITH CHECK (bearbeiter_id = auth.uid() OR auth_rolle() = 'admin');

CREATE POLICY beg_update ON begehungen
  FOR UPDATE TO authenticated
  USING (bearbeiter_id = auth.uid() OR auth_rolle() = 'admin');

CREATE POLICY beg_delete ON begehungen
  FOR DELETE TO authenticated
  USING (bearbeiter_id = auth.uid() OR auth_rolle() = 'admin');

-- begehung_teilnehmer: Zugriff gekoppelt an begehungen
CREATE POLICY begt_select ON begehung_teilnehmer
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM begehungen b
      WHERE b.id = begehung_id
        AND (b.bearbeiter_id = auth.uid() OR auth_rolle() = 'admin')
    )
  );

CREATE POLICY begt_insert ON begehung_teilnehmer
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM begehungen b
      WHERE b.id = begehung_id
        AND (b.bearbeiter_id = auth.uid() OR auth_rolle() = 'admin')
    )
  );

CREATE POLICY begt_update ON begehung_teilnehmer
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM begehungen b
      WHERE b.id = begehung_id
        AND (b.bearbeiter_id = auth.uid() OR auth_rolle() = 'admin')
    )
  );

CREATE POLICY begt_delete ON begehung_teilnehmer
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM begehungen b
      WHERE b.id = begehung_id
        AND (b.bearbeiter_id = auth.uid() OR auth_rolle() = 'admin')
    )
  );
