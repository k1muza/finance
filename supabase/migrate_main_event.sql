-- Migration: add is_main_event to events
-- Run this in the Supabase SQL Editor

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS is_main_event BOOLEAN NOT NULL DEFAULT FALSE;

-- Enforce at most one main event per session (safety net)
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_session_main
  ON events(session_id)
  WHERE is_main_event = TRUE;

-- Trigger: automatically unset the previous main event when a new one is marked
CREATE OR REPLACE FUNCTION enforce_single_main_event()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_main_event = TRUE THEN
    UPDATE events
      SET is_main_event = FALSE
      WHERE session_id = NEW.session_id
        AND id != NEW.id
        AND is_main_event = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_single_main_event
  BEFORE INSERT OR UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION enforce_single_main_event();
