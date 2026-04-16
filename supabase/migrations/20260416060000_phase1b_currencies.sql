-- ============================================================
-- B2.2: Global currencies reference table
-- Provides a district-accessible catalog for currency dropdowns.
-- Account and district currency columns remain TEXT for flexibility;
-- the currencies table is the authoritative list of supported codes.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.currencies (
  code     TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  symbol   TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_currencies" ON public.currencies;
CREATE POLICY "authenticated_read_currencies" ON public.currencies
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "superuser_manage_currencies" ON public.currencies;
CREATE POLICY "superuser_manage_currencies" ON public.currencies
  FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

INSERT INTO public.currencies (code, name, symbol) VALUES
  ('USD', 'US Dollar',           '$'),
  ('EUR', 'Euro',                '€'),
  ('GBP', 'British Pound',       '£'),
  ('ZAR', 'South African Rand',  'R'),
  ('ZWG', 'Zimbabwe Gold',       'ZWG'),
  ('ZMW', 'Zambian Kwacha',      'ZK'),
  ('MWK', 'Malawian Kwacha',     'MK'),
  ('GHS', 'Ghanaian Cedi',       '₵'),
  ('NGN', 'Nigerian Naira',      '₦'),
  ('KES', 'Kenyan Shilling',     'KSh'),
  ('UGX', 'Ugandan Shilling',    'USh'),
  ('TZS', 'Tanzanian Shilling',  'TSh'),
  ('RWF', 'Rwandan Franc',       'FRw'),
  ('ETB', 'Ethiopian Birr',      'Br')
ON CONFLICT (code) DO NOTHING;

-- Also add new codes to the existing currency_code enum used by accounts
-- (ADD VALUE is non-transactional in PG, must run outside a transaction block)
ALTER TYPE public.currency_code ADD VALUE IF NOT EXISTS 'GHS';
ALTER TYPE public.currency_code ADD VALUE IF NOT EXISTS 'NGN';
ALTER TYPE public.currency_code ADD VALUE IF NOT EXISTS 'KES';
ALTER TYPE public.currency_code ADD VALUE IF NOT EXISTS 'UGX';
ALTER TYPE public.currency_code ADD VALUE IF NOT EXISTS 'TZS';
ALTER TYPE public.currency_code ADD VALUE IF NOT EXISTS 'RWF';
ALTER TYPE public.currency_code ADD VALUE IF NOT EXISTS 'ETB';
ALTER TYPE public.currency_code ADD VALUE IF NOT EXISTS 'ZMW';
ALTER TYPE public.currency_code ADD VALUE IF NOT EXISTS 'MWK';
ALTER TYPE public.currency_code ADD VALUE IF NOT EXISTS 'EUR';
ALTER TYPE public.currency_code ADD VALUE IF NOT EXISTS 'GBP';
