-- ============================================================
-- MIGRATION: Multi-tenancy alignment
-- Run this in the Supabase SQL Editor on an existing database.
-- ============================================================

-- 1. Add district_id to days
--    The old UNIQUE constraint on (date) is dropped first; uniqueness is
--    now enforced per-district.
ALTER TABLE days DROP CONSTRAINT IF EXISTS days_date_key;

ALTER TABLE days
  ADD COLUMN district_id UUID REFERENCES districts(id) ON DELETE CASCADE;

-- Backfill: if you have existing rows, assign them to a district manually:
-- UPDATE days SET district_id = '<your-district-uuid>' WHERE district_id IS NULL;

-- Then enforce NOT NULL once backfilled:
-- ALTER TABLE days ALTER COLUMN district_id SET NOT NULL;

ALTER TABLE days
  ADD CONSTRAINT days_district_date_unique UNIQUE (district_id, date);

CREATE INDEX IF NOT EXISTS idx_days_district ON days(district_id);

-- 2. Add district_id to pages
--    The old UNIQUE constraint on (slug) is replaced with per-district uniqueness.
ALTER TABLE pages DROP CONSTRAINT IF EXISTS pages_slug_key;

ALTER TABLE pages
  ADD COLUMN district_id UUID REFERENCES districts(id) ON DELETE CASCADE;

-- Backfill: assign existing pages to a district manually:
-- UPDATE pages SET district_id = '<your-district-uuid>' WHERE district_id IS NULL;

-- Then enforce NOT NULL once backfilled:
-- ALTER TABLE pages ALTER COLUMN district_id SET NOT NULL;

ALTER TABLE pages
  ADD CONSTRAINT pages_district_slug_unique UNIQUE (district_id, slug);

CREATE INDEX IF NOT EXISTS idx_pages_district ON pages(district_id);
