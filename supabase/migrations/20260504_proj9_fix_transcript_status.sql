-- BUG-4: transcript_status war NOT NULL DEFAULT 'pending' für alle Nachrichtentypen.
-- Nicht-Audio-Nachrichten (text, foto) werden nie transkribiert und sollen NULL haben.

-- Constraint entfernen und Default auf NULL setzen
ALTER TABLE incoming_messages
  ALTER COLUMN transcript_status DROP NOT NULL,
  ALTER COLUMN transcript_status SET DEFAULT NULL;

-- Bestehende Nicht-Audio-Zeilen auf NULL setzen
UPDATE incoming_messages
SET transcript_status = NULL
WHERE message_type != 'audio';
