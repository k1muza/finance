-- ============================================================
-- B1.1: Introduce user_profiles and district_users
--
-- user_profiles replaces the legacy single-district profiles table
--   for the new multi-district model.
-- district_users is the membership join table; a user can belong
--   to multiple districts.
--
-- The existing profiles table is left in place.  Once B1.4 ships
-- (RLS helpers migrated) and all app code has been cut over, a
-- subsequent migration can drop it.
-- ============================================================

-- --------------------------------------------------------
-- user_profiles
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT,
  is_superuser  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_user_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "users_update_own_user_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "superuser_manage_user_profiles" ON public.user_profiles;

CREATE POLICY "users_read_own_user_profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_update_own_user_profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Superusers can read/manage all profiles
CREATE POLICY "superuser_manage_user_profiles" ON public.user_profiles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.is_superuser = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.is_superuser = TRUE
    )
  );

-- --------------------------------------------------------
-- district_role enum
-- --------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.district_role AS ENUM (
    'treasurer',
    'preparer',
    'approver',
    'viewer',
    'admin'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- --------------------------------------------------------
-- district_users
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.district_users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id UUID NOT NULL REFERENCES public.districts(id) ON DELETE RESTRICT,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        public.district_role NOT NULL DEFAULT 'viewer',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  invited_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (district_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_district_users_user
  ON public.district_users(user_id);
CREATE INDEX IF NOT EXISTS idx_district_users_district
  ON public.district_users(district_id);
CREATE INDEX IF NOT EXISTS idx_district_users_user_active
  ON public.district_users(user_id, is_active);

DROP TRIGGER IF EXISTS trg_district_users_updated_at ON public.district_users;
CREATE TRIGGER trg_district_users_updated_at
  BEFORE UPDATE ON public.district_users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.district_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "district_members_read_own_memberships" ON public.district_users;
DROP POLICY IF EXISTS "district_admin_manage_memberships" ON public.district_users;
DROP POLICY IF EXISTS "superuser_manage_all_memberships" ON public.district_users;

-- Members can read their own memberships
CREATE POLICY "district_members_read_own_memberships" ON public.district_users
  FOR SELECT USING (user_id = auth.uid());

-- District admins can manage memberships for their district
CREATE POLICY "district_admin_manage_memberships" ON public.district_users
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.district_users du
      WHERE du.district_id = district_id
        AND du.user_id = auth.uid()
        AND du.role = 'admin'
        AND du.is_active = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.district_users du
      WHERE du.district_id = district_id
        AND du.user_id = auth.uid()
        AND du.role = 'admin'
        AND du.is_active = TRUE
    )
  );

-- Superusers can manage all memberships
CREATE POLICY "superuser_manage_all_memberships" ON public.district_users
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.is_superuser = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.is_superuser = TRUE
    )
  );

-- --------------------------------------------------------
-- Backfill: create user_profiles rows for existing auth users
--   and district_users rows from existing profiles
-- --------------------------------------------------------

INSERT INTO public.user_profiles (id, is_superuser, created_at)
SELECT
  p.id,
  (p.role = 'admin'),
  p.created_at
FROM public.profiles p
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.district_users (district_id, user_id, role, is_active, created_at)
SELECT
  p.district_id,
  p.id,
  CASE WHEN p.role = 'admin' THEN 'admin'::public.district_role ELSE 'treasurer'::public.district_role END,
  TRUE,
  p.created_at
FROM public.profiles p
WHERE p.district_id IS NOT NULL
ON CONFLICT (district_id, user_id) DO NOTHING;
