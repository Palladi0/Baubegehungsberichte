-- PROJ-1: Benutzer-Authentifizierung
-- Eigene Profil-Tabelle für Rollen, Aktivstatus und Account-Lockout.

CREATE TABLE nutzer_profile (
  id                        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rolle                     TEXT NOT NULL DEFAULT 'mitarbeiter'
                              CHECK (rolle IN ('admin', 'mitarbeiter')),
  aktiv                     BOOLEAN NOT NULL DEFAULT TRUE,
  fehlgeschlagene_versuche  INTEGER NOT NULL DEFAULT 0,
  gesperrt_bis              TIMESTAMPTZ,
  zuletzt_eingeloggt_am     TIMESTAMPTZ,
  erstellt_am               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE nutzer_profile ENABLE ROW LEVEL SECURITY;

-- Nutzer dürfen ihr eigenes Profil lesen
CREATE POLICY "Eigenes Profil lesen" ON nutzer_profile
  FOR SELECT USING (auth.uid() = id);

-- Service-Rolle darf alles (für Admin-API-Routen mit Service-Key)
CREATE POLICY "Service-Rolle Vollzugriff nutzer_profile" ON nutzer_profile
  FOR ALL USING (auth.role() = 'service_role');

-- Admins dürfen alle Profile lesen
CREATE POLICY "Admins lesen alle Profile" ON nutzer_profile
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM nutzer_profile np
      WHERE np.id = auth.uid() AND np.rolle = 'admin'
    )
  );

CREATE INDEX idx_nutzer_profile_rolle ON nutzer_profile (rolle);
CREATE INDEX idx_nutzer_profile_aktiv ON nutzer_profile (aktiv);
