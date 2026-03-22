-- ============================================================
-- MIGRATION: Replace polymorphic person_roles with explicit role tables
-- Run this in the Supabase SQL Editor on the live database.
-- ============================================================

-- ─────────────────────────────────────────
-- 1. Create district_roles
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS district_roles (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  district_id  UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  person_id    UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('chairperson', 'vice_chairperson', 'secretary', 'vice_secretary')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (district_id, role)
);

CREATE INDEX IF NOT EXISTS idx_district_roles_district ON district_roles(district_id);
CREATE INDEX IF NOT EXISTS idx_district_roles_person   ON district_roles(person_id);

CREATE OR REPLACE FUNCTION validate_district_role()
RETURNS TRIGGER AS $$
DECLARE
  person_region_id   UUID;
  region_district_id UUID;
BEGIN
  SELECT region_id INTO person_region_id FROM people WHERE id = NEW.person_id;
  IF person_region_id IS NULL THEN
    RAISE EXCEPTION 'Person has no region assignment';
  END IF;
  SELECT district_id INTO region_district_id FROM regions WHERE id = person_region_id;
  IF region_district_id IS NULL OR region_district_id != NEW.district_id THEN
    RAISE EXCEPTION 'Person is not associated with this district';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_district_role ON district_roles;
CREATE TRIGGER trg_validate_district_role
  BEFORE INSERT OR UPDATE ON district_roles
  FOR EACH ROW EXECUTE FUNCTION validate_district_role();

ALTER TABLE district_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_all" ON district_roles;
CREATE POLICY "admin_all" ON district_roles FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────
-- 2. Create region_roles
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS region_roles (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  region_id  UUID NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  person_id  UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('chairperson', 'vice_chairperson', 'secretary', 'vice_secretary')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (region_id, role)
);

CREATE INDEX IF NOT EXISTS idx_region_roles_region ON region_roles(region_id);
CREATE INDEX IF NOT EXISTS idx_region_roles_person ON region_roles(person_id);

CREATE OR REPLACE FUNCTION validate_region_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM people WHERE id = NEW.person_id AND region_id = NEW.region_id) THEN
    RAISE EXCEPTION 'Person is not a member of this region';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_region_role ON region_roles;
CREATE TRIGGER trg_validate_region_role
  BEFORE INSERT OR UPDATE ON region_roles
  FOR EACH ROW EXECUTE FUNCTION validate_region_role();

ALTER TABLE region_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_all" ON region_roles;
CREATE POLICY "admin_all" ON region_roles FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────
-- 3. Create department_roles
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS department_roles (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  person_id     UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('hod')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (department_id, role)
);

CREATE INDEX IF NOT EXISTS idx_department_roles_department ON department_roles(department_id);
CREATE INDEX IF NOT EXISTS idx_department_roles_person     ON department_roles(person_id);

ALTER TABLE department_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_all" ON department_roles;
CREATE POLICY "admin_all" ON department_roles FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────
-- 4. Migrate existing data from person_roles
-- ─────────────────────────────────────────
INSERT INTO district_roles (district_id, person_id, role, created_at)
SELECT entity_id, person_id, role, created_at
FROM person_roles
WHERE entity_type = 'district'
ON CONFLICT (district_id, role) DO NOTHING;

INSERT INTO region_roles (region_id, person_id, role, created_at)
SELECT entity_id, person_id, role, created_at
FROM person_roles
WHERE entity_type = 'region'
ON CONFLICT (region_id, role) DO NOTHING;

INSERT INTO department_roles (department_id, person_id, role, created_at)
SELECT entity_id, person_id, role, created_at
FROM person_roles
WHERE entity_type = 'department'
ON CONFLICT (department_id, role) DO NOTHING;

-- ─────────────────────────────────────────
-- 5. Drop old person_roles table
-- ─────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_validate_person_role ON person_roles;
DROP FUNCTION IF EXISTS validate_person_role();
DROP TABLE IF EXISTS person_roles;
