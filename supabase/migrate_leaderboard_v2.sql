-- ─────────────────────────────────────────
-- LEADERBOARD v2 — adds district_id so the
-- dashboard can filter per-district.
-- Run this after schema_certificates.sql.
-- ─────────────────────────────────────────
CREATE OR REPLACE VIEW leaderboard AS
WITH ranked AS (
  SELECT
    p.id,
    p.name,
    p.gender,
    p.contribution,
    r.name       AS region_name,
    r.district_id,
    d.name       AS department_name,
    RANK() OVER (ORDER BY p.contribution DESC) AS rank
  FROM people p
  LEFT JOIN regions     r ON r.id = p.region_id
  LEFT JOIN departments d ON d.id = p.department_id
)
SELECT
  ranked.*,
  CASE
    WHEN ranked.rank = 1 THEN (
      SELECT c.name FROM certificates c WHERE c.is_grand_prize = true LIMIT 1
    )
    ELSE (
      SELECT c.name FROM certificates c
      WHERE  c.is_grand_prize = false
        AND  ranked.contribution >= COALESCE(c.min_amount, 0)
        AND  (c.max_amount IS NULL OR ranked.contribution < c.max_amount)
      ORDER BY COALESCE(c.min_amount, 0) DESC
      LIMIT 1
    )
  END AS certificate_name
FROM ranked;
