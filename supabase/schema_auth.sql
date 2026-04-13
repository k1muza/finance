CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  district_id UUID REFERENCES public.districts(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'district' CHECK (role IN ('admin', 'district')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (role = 'admin' AND district_id IS NULL)
    OR (role = 'district' AND district_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_profiles_district ON public.profiles(district_id);

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_district_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT district_id
  FROM public.profiles
  WHERE id = auth.uid();
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "admin_manage_profiles" ON public.profiles;
CREATE POLICY "users_read_own_profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "admin_manage_profiles" ON public.profiles
  FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
