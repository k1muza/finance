-- ============================================================
-- B2.1: Expand district metadata
-- Adds slug, country, default_currency, created_by, is_active
-- ============================================================

ALTER TABLE public.districts
  ADD COLUMN IF NOT EXISTS slug          TEXT,
  ADD COLUMN IF NOT EXISTS country       TEXT,
  ADD COLUMN IF NOT EXISTS default_currency TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_active     BOOLEAN NOT NULL DEFAULT TRUE;

-- Unique slug index (sparse — slug may be null for legacy rows)
CREATE UNIQUE INDEX IF NOT EXISTS idx_districts_slug
  ON public.districts(slug)
  WHERE slug IS NOT NULL AND btrim(slug) <> '';

-- Back-fill slugs for existing rows (lower-case, hyphen-separated)
UPDATE public.districts
SET slug = lower(regexp_replace(btrim(name), '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;
