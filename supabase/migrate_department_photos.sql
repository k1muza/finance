-- Migration: department photos per district
-- Run this in the Supabase SQL Editor

CREATE TABLE department_photos (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_id  UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  district_id    UUID NOT NULL REFERENCES districts(id)  ON DELETE CASCADE,
  url            TEXT NOT NULL,
  caption        TEXT,
  taken_at       TIMESTAMPTZ,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_department_photos_dept     ON department_photos(department_id);
CREATE INDEX idx_department_photos_district ON department_photos(district_id);

CREATE TRIGGER trg_department_photos_updated_at
  BEFORE UPDATE ON department_photos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE department_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON department_photos FOR ALL USING (true) WITH CHECK (true);
