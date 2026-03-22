-- ─────────────────────────────────────────
-- SEED: Super Admin User
-- Email:    ado@gmail.com
-- Password: Conference2026!
--
-- Run this in the Supabase SQL Editor AFTER running schema_auth.sql.
-- You can change the password afterwards via the Supabase Dashboard
-- (Authentication → Users → Edit) or via the app's forgot-password flow.
-- ─────────────────────────────────────────

DO $$
DECLARE
  admin_id UUID := 'a1a1a1a1-0000-0000-0000-000000000001';
BEGIN

  -- 1. Create the auth user
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role,
    created_at,
    updated_at
  ) VALUES (
    admin_id,
    '00000000-0000-0000-0000-000000000000',
    'ado@gmail.com',
    crypt('Conference2026!', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    'authenticated',
    'authenticated',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  -- 2. Upsert the profile as super admin (no district = sees everything)
  INSERT INTO profiles (id, district_id, role)
  VALUES (admin_id, NULL, 'admin')
  ON CONFLICT (id) DO UPDATE SET role = 'admin', district_id = NULL;

END;
$$;
