-- Migration 007: Berichte-Dashboard — Status-Feld (PROJ-7)

ALTER TABLE berichte
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'entwurf'
    CHECK (status IN ('entwurf', 'fertig'));

CREATE INDEX IF NOT EXISTS berichte_status_idx ON berichte(status);
