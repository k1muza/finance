-- ============================================================
-- PAGES — Rich-content pages exposed to the mobile app
-- Run this in the Supabase SQL Editor after schema.sql.
-- ============================================================

CREATE TABLE pages (
  id                  UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  title               TEXT         NOT NULL,
  slug                TEXT         NOT NULL UNIQUE,
  content             TEXT,                        -- HTML produced by the rich-text editor
  featured_image_url  TEXT,
  icon_class          TEXT,                        -- full MDI class string, e.g. "mdi mdi-home"
  sort_order          INTEGER      NOT NULL DEFAULT 0,
  published           BOOLEAN      NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pages_slug ON pages(slug);

CREATE TRIGGER trg_pages_updated_at
  BEFORE UPDATE ON pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON pages FOR ALL USING (true) WITH CHECK (true);
