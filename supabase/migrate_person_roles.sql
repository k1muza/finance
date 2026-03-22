-- ============================================================
-- MIGRATION: People-Roles System
-- Run this in the Supabase SQL Editor on the live database.
-- This replaces leadership text fields on districts/regions
-- with a normalised person_roles junction table.
-- ============================================================

-- 1. Drop leadership text columns from districts
ALTER TABLE districts
  DROP COLUMN IF EXISTS chairperson,
  DROP COLUMN IF EXISTS vice_chairperson,
  DROP COLUMN IF EXISTS secretary,
  DROP COLUMN IF EXISTS vice_secretary;

-- 2. Drop leadership text columns from regions
ALTER TABLE regions
  DROP COLUMN IF EXISTS chairperson,
  DROP COLUMN IF EXISTS vice_chairperson,
  DROP COLUMN IF EXISTS secretary,
  DROP COLUMN IF EXISTS vice_secretary;

-- 3. Create person_roles table
CREATE TABLE IF NOT EXISTS person_roles (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  person_id    UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  entity_type  TEXT NOT NULL CHECK (entity_type IN ('district', 'region')),
  entity_id    UUID NOT NULL,
  role         TEXT NOT NULL CHECK (role IN ('chairperson', 'vice_chairperson', 'secretary', 'vice_secretary')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_type, entity_id, role)
);

CREATE INDEX IF NOT EXISTS idx_person_roles_entity ON person_roles(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_person_roles_person ON person_roles(person_id);

-- 4. Membership validation trigger
CREATE OR REPLACE FUNCTION validate_person_role()
RETURNS TRIGGER AS $$
DECLARE
  person_region_id    UUID;
  region_district_id  UUID;
BEGIN
  SELECT region_id INTO person_region_id FROM people WHERE id = NEW.person_id;

  IF NEW.entity_type = 'region' THEN
    IF person_region_id IS NULL OR person_region_id != NEW.entity_id THEN
      RAISE EXCEPTION 'Person is not a member of this region';
    END IF;
  ELSIF NEW.entity_type = 'district' THEN
    IF person_region_id IS NULL THEN
      RAISE EXCEPTION 'Person has no region assignment';
    END IF;
    SELECT district_id INTO region_district_id FROM regions WHERE id = person_region_id;
    IF region_district_id IS NULL OR region_district_id != NEW.entity_id THEN
      RAISE EXCEPTION 'Person is not associated with this district';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_person_role ON person_roles;
CREATE TRIGGER trg_validate_person_role
  BEFORE INSERT OR UPDATE ON person_roles
  FOR EACH ROW EXECUTE FUNCTION validate_person_role();

-- 5. RLS
ALTER TABLE person_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_all" ON person_roles;
CREATE POLICY "admin_all" ON person_roles FOR ALL USING (true) WITH CHECK (true);
