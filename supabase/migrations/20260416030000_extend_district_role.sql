-- ============================================================
-- B0.4: Extend district_role enum with full role matrix roles
--
-- Previous enum: treasurer, preparer, approver, viewer, admin
-- New values added: secretary, clerk, auditor
--
-- Postgres allows adding values to an existing enum but not renaming
-- or removing them.  The legacy preparer and approver values are
-- left in the type but are no longer assigned by app code.
-- ============================================================

ALTER TYPE public.district_role ADD VALUE IF NOT EXISTS 'secretary';
ALTER TYPE public.district_role ADD VALUE IF NOT EXISTS 'clerk';
ALTER TYPE public.district_role ADD VALUE IF NOT EXISTS 'auditor';
