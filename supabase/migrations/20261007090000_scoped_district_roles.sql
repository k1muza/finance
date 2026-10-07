-- ============================================================
-- Add region-, assembly- and department-scoped church roles.
--
-- Kept in its own migration because newly added enum values
-- cannot be used in the transaction that adds them; the scope
-- rules and policies that reference them follow in
-- 20261007090100_departments_scope_and_visibility.sql.
-- ============================================================

ALTER TYPE public.district_role ADD VALUE IF NOT EXISTS 'regional_pastor';
ALTER TYPE public.district_role ADD VALUE IF NOT EXISTS 'assembly_coordinator';
ALTER TYPE public.district_role ADD VALUE IF NOT EXISTS 'assembly_secretary';
ALTER TYPE public.district_role ADD VALUE IF NOT EXISTS 'departmental_chairperson';
ALTER TYPE public.district_role ADD VALUE IF NOT EXISTS 'departmental_secretary';
