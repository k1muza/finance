-- ============================================================
-- MEAL MENU — Addendum to schema.sql
-- Adds a list of dishes/items served at each meal.
-- Run this AFTER schema.sql in the Supabase SQL Editor.
-- ============================================================

-- ─────────────────────────────────────────
-- MEAL MENU ITEMS
-- ─────────────────────────────────────────
CREATE TABLE meal_menu_items (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  meal_id     UUID    NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  notes       TEXT,                         -- e.g. "Vegetarian", "Gluten-free"
  sort_order  INTEGER NOT NULL DEFAULT 0,   -- display order within the meal
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_meal_menu_items_meal ON meal_menu_items(meal_id);

-- ─────────────────────────────────────────
-- AUTO-UPDATE updated_at TRIGGER
-- ─────────────────────────────────────────
CREATE TRIGGER trg_meal_menu_items_updated_at
  BEFORE UPDATE ON meal_menu_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────
ALTER TABLE meal_menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all" ON meal_menu_items FOR ALL USING (true) WITH CHECK (true);
