-- ============================================================
-- Replace generic district roles with church office roles
--
--   admin      → district_pastor
--   treasurer  → accounting_officer
--   clerk      → assistant_accounting_officer
--   secretary  → district_secretary
--   auditor    → regional_coordinator
--   viewer     → ministerial_secretary
--   (new)        district_coordinator, regional_secretary,
--                ministerial_chairperson
--
-- Renaming enum values migrates existing district_users rows and
-- policy expressions in place.  SQL function bodies that compare
-- against role literals are recreated in the follow-up migration,
-- because newly added enum values cannot be used in the same
-- transaction that adds them.
--
-- Legacy preparer / approver values stay in the type (Postgres
-- cannot drop enum values); any remaining rows are remapped.
-- ============================================================

ALTER TYPE public.district_role RENAME VALUE 'admin'     TO 'district_pastor';
ALTER TYPE public.district_role RENAME VALUE 'treasurer' TO 'accounting_officer';
ALTER TYPE public.district_role RENAME VALUE 'clerk'     TO 'assistant_accounting_officer';
ALTER TYPE public.district_role RENAME VALUE 'secretary' TO 'district_secretary';
ALTER TYPE public.district_role RENAME VALUE 'auditor'   TO 'regional_coordinator';
ALTER TYPE public.district_role RENAME VALUE 'viewer'    TO 'ministerial_secretary';

ALTER TYPE public.district_role ADD VALUE IF NOT EXISTS 'district_coordinator';
ALTER TYPE public.district_role ADD VALUE IF NOT EXISTS 'regional_secretary';
ALTER TYPE public.district_role ADD VALUE IF NOT EXISTS 'ministerial_chairperson';

UPDATE public.district_users SET role = 'assistant_accounting_officer' WHERE role = 'preparer';
UPDATE public.district_users SET role = 'accounting_officer'           WHERE role = 'approver';
