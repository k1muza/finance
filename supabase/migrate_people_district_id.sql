-- Migration: add district_id to people
-- Run this in the Supabase SQL Editor

ALTER TABLE people
  ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES districts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_people_district ON people(district_id);

-- Backfill district_id from the person's region (where a region exists)
UPDATE people p
SET district_id = r.district_id
FROM regions r
WHERE p.region_id = r.id
  AND p.district_id IS NULL;
