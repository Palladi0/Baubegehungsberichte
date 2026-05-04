-- PROJ-9: Sprach-Transkription (Whisper)

-- Felder in incoming_messages ergänzen
ALTER TABLE incoming_messages
  ADD COLUMN IF NOT EXISTS transcript              TEXT,
  ADD COLUMN IF NOT EXISTS transcript_status       TEXT NOT NULL DEFAULT 'pending'
                             CHECK (transcript_status IN ('pending', 'processing', 'done', 'failed')),
  ADD COLUMN IF NOT EXISTS audio_duration_seconds  NUMERIC(8,2);

-- Index für schnelle Filterung nach transcript_status
CREATE INDEX IF NOT EXISTS idx_inc_msg_transcript_status
  ON incoming_messages (transcript_status)
  WHERE message_type = 'audio';

-- Asynchrone Job-Queue für Whisper-Transkription
CREATE TABLE transcription_jobs (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incoming_message_id  UUID NOT NULL REFERENCES incoming_messages(id) ON DELETE CASCADE,
  status               TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  attempts             INTEGER NOT NULL DEFAULT 0,
  duration_seconds     NUMERIC(8,2),
  cost_usd             NUMERIC(10,6),
  last_error           TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE transcription_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service-Rolle Vollzugriff transcription_jobs" ON transcription_jobs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admins lesen transcription_jobs" ON transcription_jobs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM nutzer_profile
      WHERE id = auth.uid() AND rolle = 'admin'
    )
  );

CREATE INDEX idx_transcription_jobs_status     ON transcription_jobs (status);
CREATE INDEX idx_transcription_jobs_message_id ON transcription_jobs (incoming_message_id);
CREATE INDEX idx_transcription_jobs_created    ON transcription_jobs (created_at DESC);

CREATE TRIGGER transcription_jobs_updated_at
  BEFORE UPDATE ON transcription_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
