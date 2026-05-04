-- Migration 004: Medien-Verwaltung
-- Tabelle: fotos

CREATE TABLE fotos (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  projekt_id            uuid        NOT NULL REFERENCES projekte(id) ON DELETE CASCADE,
  begehung_id           uuid        REFERENCES begehungen(id) ON DELETE SET NULL,
  uploader_id           uuid        NOT NULL REFERENCES nutzer_profile(id) ON DELETE CASCADE,
  original_dateiname    text        NOT NULL,
  datei_endung          text        NOT NULL,
  dateigroesse_original bigint      NOT NULL,
  bildunterschrift      text        CHECK (char_length(bildunterschrift) <= 500),
  geloescht_am          timestamptz,
  erstellt_am           timestamptz NOT NULL DEFAULT now(),
  aktualisiert_am       timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX ON fotos(projekt_id);
CREATE INDEX ON fotos(begehung_id);
CREATE INDEX ON fotos(uploader_id);
CREATE INDEX ON fotos(erstellt_am DESC);
CREATE INDEX ON fotos(geloescht_am) WHERE geloescht_am IS NULL;

-- Trigger: aktualisiert_am automatisch setzen (reuse function from migration 002)
CREATE TRIGGER trg_fotos_aktualisiert_am
  BEFORE UPDATE ON fotos
  FOR EACH ROW EXECUTE FUNCTION set_aktualisiert_am();

-- RLS
ALTER TABLE fotos ENABLE ROW LEVEL SECURITY;

-- Admin sieht alle Fotos (auch soft-gelöschte)
CREATE POLICY fotos_select_admin ON fotos
  FOR SELECT TO authenticated
  USING (auth_rolle() = 'admin');

-- Mitarbeiter sehen nur aktive Fotos ihrer zugeordneten Projekte
CREATE POLICY fotos_select_mitarbeiter ON fotos
  FOR SELECT TO authenticated
  USING (
    auth_rolle() = 'mitarbeiter'
    AND geloescht_am IS NULL
    AND EXISTS (
      SELECT 1 FROM projekt_mitarbeiter pm
      WHERE pm.projekt_id = fotos.projekt_id AND pm.nutzer_id = auth.uid()
    )
  );

-- Aktive Mitarbeiter können Fotos in ihre zugeordneten Projekte hochladen
CREATE POLICY fotos_insert ON fotos
  FOR INSERT TO authenticated
  WITH CHECK (
    uploader_id = auth.uid()
    AND auth_rolle() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM projekt_mitarbeiter pm
      WHERE pm.projekt_id = fotos.projekt_id AND pm.nutzer_id = auth.uid()
    )
  );

-- Besitzer oder Admin können Bildunterschrift und Begehungszuordnung aktualisieren
CREATE POLICY fotos_update ON fotos
  FOR UPDATE TO authenticated
  USING (uploader_id = auth.uid() OR auth_rolle() = 'admin');

-- Besitzer oder Admin können soft-löschen (DELETE-Policy gilt für physisches Löschen via Service-Role;
-- Soft-Delete läuft über UPDATE, aber diese Policy schützt den Datensatz vor unautorisiertem Löschen)
CREATE POLICY fotos_delete ON fotos
  FOR DELETE TO authenticated
  USING (uploader_id = auth.uid() OR auth_rolle() = 'admin');
