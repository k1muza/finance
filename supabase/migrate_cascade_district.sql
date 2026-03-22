-- ============================================================
-- Migration: fix cascade behaviour on district deletion
--
-- Problems fixed:
--   1. expenses.district_id was ON DELETE RESTRICT — blocks district deletion
--   2. people.region_id was ON DELETE SET NULL — orphans people instead of removing them
--
-- After this migration, deleting a district cascades to:
--   districts → regions → people → contributions
--                                 → person_roles
--            → days    → sessions → events
--                      → meals
--            → expenses
-- ============================================================

-- 1. expenses: RESTRICT → CASCADE
ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS expenses_district_id_fkey;

ALTER TABLE expenses
  ADD CONSTRAINT expenses_district_id_fkey
  FOREIGN KEY (district_id) REFERENCES districts(id) ON DELETE CASCADE;

-- 2. people: SET NULL → CASCADE (person belongs to their region; no region = no record)
ALTER TABLE people
  DROP CONSTRAINT IF EXISTS people_region_id_fkey;

ALTER TABLE people
  ADD CONSTRAINT people_region_id_fkey
  FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE CASCADE;
