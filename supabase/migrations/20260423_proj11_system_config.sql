-- PROJ-11: WhatsApp Business API Migration — system_config Tabelle

CREATE TABLE system_config (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins lesen system_config" ON system_config
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM nutzer_profile
      WHERE id = auth.uid() AND rolle = 'admin'
    )
  );

CREATE POLICY "Service-Rolle Vollzugriff system_config" ON system_config
  FOR ALL USING (auth.role() = 'service_role');

-- Standard-Werte
INSERT INTO system_config (key, value) VALUES
  ('whatsapp_mode',                         'sandbox'),
  ('whatsapp_active_number',                ''),
  ('whatsapp_template_sid_bestaetigung',    ''),
  ('whatsapp_template_sid_unbekannt',       '');
