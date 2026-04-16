-- ============================================================
-- Add title to sources (individuals only)
--
-- Titles: elder, deacon, saint (default)
-- 'saint' is the baseline — no special designation.
-- Only meaningful when type = 'individual'; ignored for other types.
-- ============================================================

ALTER TABLE public.sources
  ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT 'saint'
    CHECK (title IN ('elder', 'deacon', 'saint'));
