-- Migration 002: Projektverwaltung
-- Tabellen: projekte, projekt_mitarbeiter

CREATE TABLE projekte (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  nummer      text NOT NULL,
  kuerzel     text NOT NULL,
  auftraggeber text,
  bauherr     text,
  adresse     text,
  start_datum date,
  end_datum   date,
  beschreibung text,
  archived_at timestamptz,
  erstellt_am timestamptz NOT NULL DEFAULT now(),
  aktualisiert_am timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT projekte_kuerzel_unique UNIQUE (kuerzel),
  CONSTRAINT kuerzel_format CHECK (kuerzel ~ '^[A-Za-z0-9\-]{1,20}$')
);

CREATE TABLE projekt_mitarbeiter (
  projekt_id  uuid NOT NULL REFERENCES projekte(id) ON DELETE CASCADE,
  nutzer_id   uuid NOT NULL REFERENCES nutzer_profile(id) ON DELETE CASCADE,
  erstellt_am timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (projekt_id, nutzer_id)
);

-- Indexes
CREATE INDEX ON projekte(archived_at);
CREATE INDEX ON projekte(kuerzel);
CREATE INDEX ON projekt_mitarbeiter(nutzer_id);

-- Trigger: aktualisiert_am automatisch setzen
CREATE OR REPLACE FUNCTION set_aktualisiert_am()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.aktualisiert_am = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER projekte_aktualisiert_am
  BEFORE UPDATE ON projekte
  FOR EACH ROW EXECUTE FUNCTION set_aktualisiert_am();

-- RLS aktivieren
ALTER TABLE projekte ENABLE ROW LEVEL SECURITY;
ALTER TABLE projekt_mitarbeiter ENABLE ROW LEVEL SECURITY;

-- Hilfsfunktion: eigene Rolle ermitteln
CREATE OR REPLACE FUNCTION auth_rolle()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT rolle FROM nutzer_profile WHERE id = auth.uid() AND aktiv = true;
$$;

-- projekte: Admins sehen alle, Mitarbeiter nur ihre zugeordneten
CREATE POLICY projekte_select_admin ON projekte
  FOR SELECT TO authenticated
  USING (auth_rolle() = 'admin');

CREATE POLICY projekte_select_mitarbeiter ON projekte
  FOR SELECT TO authenticated
  USING (
    auth_rolle() = 'mitarbeiter'
    AND EXISTS (
      SELECT 1 FROM projekt_mitarbeiter pm
      WHERE pm.projekt_id = id AND pm.nutzer_id = auth.uid()
    )
  );

CREATE POLICY projekte_insert_admin ON projekte
  FOR INSERT TO authenticated
  WITH CHECK (auth_rolle() = 'admin');

CREATE POLICY projekte_update_admin ON projekte
  FOR UPDATE TO authenticated
  USING (auth_rolle() = 'admin');

-- Kein physisches Löschen über RLS (nur archivieren)

-- projekt_mitarbeiter: Admins können alles, Mitarbeiter nur lesen
CREATE POLICY pm_select_admin ON projekt_mitarbeiter
  FOR SELECT TO authenticated
  USING (auth_rolle() = 'admin');

CREATE POLICY pm_select_mitarbeiter ON projekt_mitarbeiter
  FOR SELECT TO authenticated
  USING (auth_rolle() = 'mitarbeiter' AND nutzer_id = auth.uid());

CREATE POLICY pm_insert_admin ON projekt_mitarbeiter
  FOR INSERT TO authenticated
  WITH CHECK (auth_rolle() = 'admin');

CREATE POLICY pm_delete_admin ON projekt_mitarbeiter
  FOR DELETE TO authenticated
  USING (auth_rolle() = 'admin');
