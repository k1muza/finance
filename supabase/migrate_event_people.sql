-- ============================================================
-- MIGRATION: Replace events.allocated_person with event_people
-- Run this in the Supabase SQL Editor on the live database.
-- ============================================================

-- 1. Create the junction table
CREATE TABLE IF NOT EXISTS event_people (
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  person_id  UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, person_id)
);

CREATE INDEX IF NOT EXISTS idx_event_people_event  ON event_people(event_id);
CREATE INDEX IF NOT EXISTS idx_event_people_person ON event_people(person_id);

ALTER TABLE event_people ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_all" ON event_people;
CREATE POLICY "admin_all" ON event_people FOR ALL USING (true) WITH CHECK (true);

-- 2. Migrate existing single-person assignments
INSERT INTO event_people (event_id, person_id)
SELECT id, allocated_person
FROM events
WHERE allocated_person IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. Drop the old column
ALTER TABLE events DROP COLUMN IF EXISTS allocated_person;
