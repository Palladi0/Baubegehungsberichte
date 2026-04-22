-- PROJ-8: WhatsApp-Integration (Twilio Sandbox)

-- Telefonnummer-Zuordnung: Mitarbeiter ↔ WhatsApp-Nummer
CREATE TABLE phone_registrations (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  label        TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (phone_number)
);

ALTER TABLE phone_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins verwalten Telefonnummern" ON phone_registrations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM nutzer_profile
      WHERE id = auth.uid() AND rolle = 'admin'
    )
  );

CREATE INDEX idx_phone_reg_phone  ON phone_registrations (phone_number);
CREATE INDEX idx_phone_reg_user   ON phone_registrations (user_id);

-- Protokoll aller eingehenden WhatsApp-Nachrichten
CREATE TABLE incoming_messages (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  twilio_message_sid  TEXT NOT NULL UNIQUE,
  sender_phone        TEXT NOT NULL,
  user_id             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  message_type        TEXT NOT NULL CHECK (message_type IN ('text', 'audio', 'foto')),
  text_content        TEXT,
  twilio_media_url    TEXT,
  local_file_path     TEXT,
  status              TEXT NOT NULL DEFAULT 'received'
                        CHECK (status IN ('received', 'downloading', 'stored', 'failed')),
  received_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at        TIMESTAMPTZ,
  error_message       TEXT
);

ALTER TABLE incoming_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins lesen Nachrichten" ON incoming_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM nutzer_profile
      WHERE id = auth.uid() AND rolle = 'admin'
    )
  );

CREATE POLICY "Service-Rolle Vollzugriff incoming_messages" ON incoming_messages
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_inc_msg_sid        ON incoming_messages (twilio_message_sid);
CREATE INDEX idx_inc_msg_status     ON incoming_messages (status);
CREATE INDEX idx_inc_msg_received   ON incoming_messages (received_at DESC);
CREATE INDEX idx_inc_msg_sender     ON incoming_messages (sender_phone);

-- Asynchrone Job-Queue für Medien-Download
CREATE TABLE media_jobs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incoming_message_id UUID NOT NULL REFERENCES incoming_messages(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  attempts            INTEGER NOT NULL DEFAULT 0,
  last_error          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE media_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service-Rolle Vollzugriff media_jobs" ON media_jobs
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_media_jobs_status     ON media_jobs (status);
CREATE INDEX idx_media_jobs_message_id ON media_jobs (incoming_message_id);

-- Trigger: updated_at automatisch aktualisieren
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER media_jobs_updated_at
  BEFORE UPDATE ON media_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
