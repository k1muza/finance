-- ─────────────────────────────────────────
-- EXPENSES
-- Each expense is linked to a district and deducted from total contributions.
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS expenses (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  district_id  UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  description  TEXT NOT NULL,
  amount       NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_district ON expenses(district_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date     ON expenses(date DESC);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_expenses" ON expenses FOR SELECT USING (true);
CREATE POLICY "admin_all_expenses"   ON expenses FOR ALL   USING (true) WITH CHECK (true);
