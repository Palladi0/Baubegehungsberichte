-- PROJ-10: Automatische Projektzuordnung

-- incoming_messages um Zuordnungsfelder erweitern
ALTER TABLE incoming_messages
  ADD COLUMN project_id             UUID REFERENCES projekte(id) ON DELETE SET NULL,
  ADD COLUMN assignment_status      TEXT NOT NULL DEFAULT 'pending'
                                      CHECK (assignment_status IN (
                                        'pending', 'assigned', 'awaiting_clarification',
                                        'manual_required', 'failed'
                                      )),
  ADD COLUMN assignment_method      TEXT
                                      CHECK (assignment_method IN (
                                        'hashtag_text', 'hashtag_transcript',
                                        'sender_unique', 'manual', 'clarification_reply'
                                      )),
  ADD COLUMN clarification_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN clarification_sent_at  TIMESTAMPTZ;

CREATE INDEX idx_inc_msg_assignment_status ON incoming_messages (assignment_status);
CREATE INDEX idx_inc_msg_project           ON incoming_messages (project_id);
CREATE INDEX idx_inc_msg_clarification     ON incoming_messages (sender_phone, assignment_status, clarification_sent_at);

-- Neue Job-Queue für die Projektzuordnung
CREATE TABLE assignment_jobs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incoming_message_id UUID NOT NULL REFERENCES incoming_messages(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  attempts            INTEGER NOT NULL DEFAULT 0,
  last_error          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE assignment_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service-Rolle Vollzugriff assignment_jobs" ON assignment_jobs
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_assignment_jobs_status     ON assignment_jobs (status);
CREATE INDEX idx_assignment_jobs_message_id ON assignment_jobs (incoming_message_id);

CREATE TRIGGER assignment_jobs_updated_at
  BEFORE UPDATE ON assignment_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
