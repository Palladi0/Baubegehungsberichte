-- Migration 006: PDF-Export
-- Fügt PDF-Metadaten zur berichte-Tabelle hinzu (PROJ-6)

ALTER TABLE berichte
  ADD COLUMN IF NOT EXISTS pdf_pfad          text,
  ADD COLUMN IF NOT EXISTS pdf_generiert_am  timestamptz,
  ADD COLUMN IF NOT EXISTS pdf_versions_nr   integer;
