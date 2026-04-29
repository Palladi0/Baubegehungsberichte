-- PROJ-10 Bug-Fixes: assigned_at Timestamp für Zuordnungs-Protokoll

ALTER TABLE incoming_messages
  ADD COLUMN assigned_at TIMESTAMPTZ;
