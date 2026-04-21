-- ============================================================
-- Phase 3: Transfer aggregate, atomic posting, and signed effects
--
-- 1. Adds a dedicated transfers table with membership-aware RLS.
-- 2. Adds signed cashbook effect tracking so reversals and transfers
--    can balance correctly in account cashbooks and reports.
-- 3. Provides SECURITY DEFINER functions that post and reverse a
--    transfer atomically inside one database transaction.
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.transfer_status AS ENUM (
    'draft',
    'posted',
    'reversed',
    'voided'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.cashbook_effect_direction AS ENUM (
    'in',
    'out'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.district_transfer_sequences (
  district_id UUID NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  year        SMALLINT NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (district_id, year)
);

ALTER TABLE public.district_transfer_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "no_client_access_transfer_sequences" ON public.district_transfer_sequences;
CREATE POLICY "no_client_access_transfer_sequences" ON public.district_transfer_sequences
  FOR ALL USING (FALSE);

CREATE OR REPLACE FUNCTION public.next_transfer_number(p_district_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year SMALLINT := EXTRACT(YEAR FROM NOW())::SMALLINT;
  v_next INTEGER;
BEGIN
  INSERT INTO public.district_transfer_sequences (district_id, year, last_number)
  VALUES (p_district_id, v_year, 1)
  ON CONFLICT (district_id, year) DO UPDATE
    SET last_number = district_transfer_sequences.last_number + 1
  RETURNING last_number INTO v_next;

  RETURN 'TRF-' || v_year || '-' || LPAD(v_next::TEXT, 4, '0');
END;
$$;

CREATE TABLE IF NOT EXISTS public.transfers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id         UUID NOT NULL REFERENCES public.districts(id) ON DELETE RESTRICT,
  client_generated_id UUID,
  device_id           TEXT,
  transfer_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  from_account_id     UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  to_account_id       UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  amount              NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  reference_no        TEXT,
  description         TEXT,
  status              public.transfer_status NOT NULL DEFAULT 'draft',
  captured_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  posted_by_user_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  posted_at           TIMESTAMPTZ,
  reversed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reversed_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (from_account_id <> to_account_id)
);

CREATE INDEX IF NOT EXISTS idx_transfers_district
  ON public.transfers(district_id);

CREATE INDEX IF NOT EXISTS idx_transfers_district_status
  ON public.transfers(district_id, status);

CREATE INDEX IF NOT EXISTS idx_transfers_district_date
  ON public.transfers(district_id, transfer_date DESC);

CREATE INDEX IF NOT EXISTS idx_transfers_from_account
  ON public.transfers(from_account_id);

CREATE INDEX IF NOT EXISTS idx_transfers_to_account
  ON public.transfers(to_account_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_transfers_client_generated_id
  ON public.transfers(client_generated_id)
  WHERE client_generated_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transfers_district_reference_no
  ON public.transfers(district_id, reference_no)
  WHERE reference_no IS NOT NULL AND btrim(reference_no) <> '';

DROP TRIGGER IF EXISTS trg_transfers_updated_at ON public.transfers;
CREATE TRIGGER trg_transfers_updated_at
  BEFORE UPDATE ON public.transfers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_transfers" ON public.transfers;
DROP POLICY IF EXISTS "district_member_manage_transfers" ON public.transfers;

CREATE POLICY "admin_manage_transfers" ON public.transfers
  FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE POLICY "district_member_manage_transfers" ON public.transfers
  FOR ALL
  USING (public.is_district_member(district_id) OR public.is_admin_user())
  WITH CHECK (public.is_district_member(district_id) OR public.is_admin_user());

ALTER TABLE public.cashbook_transactions
  ADD COLUMN IF NOT EXISTS effect_direction public.cashbook_effect_direction,
  ADD COLUMN IF NOT EXISTS transfer_id UUID REFERENCES public.transfers(id) ON DELETE RESTRICT;

ALTER TABLE public.cashbook_transactions
  DISABLE TRIGGER trg_cashbook_immutability;

UPDATE public.cashbook_transactions
SET effect_direction = 'in'
WHERE effect_direction IS NULL
  AND kind IN ('receipt', 'opening_balance', 'adjustment');

UPDATE public.cashbook_transactions
SET effect_direction = 'out'
WHERE effect_direction IS NULL
  AND kind IN ('payment', 'transfer');

UPDATE public.cashbook_transactions AS txn
SET effect_direction = CASE
  WHEN source.effect_direction = 'in' THEN 'out'::public.cashbook_effect_direction
  ELSE 'in'::public.cashbook_effect_direction
END
FROM public.cashbook_transactions AS source
WHERE txn.effect_direction IS NULL
  AND txn.kind = 'reversal'
  AND txn.source_transaction_id = source.id;

UPDATE public.cashbook_transactions
SET effect_direction = 'out'
WHERE effect_direction IS NULL;

ALTER TABLE public.cashbook_transactions
  ENABLE TRIGGER trg_cashbook_immutability;

ALTER TABLE public.cashbook_transactions
  ALTER COLUMN effect_direction SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cashbook_txn_effect_direction
  ON public.cashbook_transactions(district_id, effect_direction);

CREATE INDEX IF NOT EXISTS idx_cashbook_txn_transfer
  ON public.cashbook_transactions(transfer_id)
  WHERE transfer_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_transfer_accounts(
  p_district_id UUID,
  p_from_account_id UUID,
  p_to_account_id UUID
)
RETURNS TABLE (
  from_currency public.currency_code,
  to_currency public.currency_code
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from RECORD;
  v_to   RECORD;
BEGIN
  SELECT id, district_id, currency, status
  INTO v_from
  FROM public.accounts
  WHERE id = p_from_account_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source account not found';
  END IF;

  SELECT id, district_id, currency, status
  INTO v_to
  FROM public.accounts
  WHERE id = p_to_account_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Destination account not found';
  END IF;

  IF v_from.status <> 'active' OR v_to.status <> 'active' THEN
    RAISE EXCEPTION 'Both transfer accounts must be active';
  END IF;

  IF v_from.district_id <> p_district_id OR v_to.district_id <> p_district_id THEN
    RAISE EXCEPTION 'Transfer accounts must belong to the selected district';
  END IF;

  IF p_from_account_id = p_to_account_id THEN
    RAISE EXCEPTION 'Transfer accounts must be different';
  END IF;

  IF v_from.currency <> v_to.currency THEN
    RAISE EXCEPTION 'Transfer accounts must share the same currency';
  END IF;

  RETURN QUERY
  SELECT v_from.currency::public.currency_code, v_to.currency::public.currency_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.post_transfer(
  p_transfer_id UUID,
  p_actor_id UUID
)
RETURNS public.transfers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer   public.transfers%ROWTYPE;
  v_from       RECORD;
  v_to         RECORD;
  v_reference  TEXT;
  v_now        TIMESTAMPTZ := NOW();
BEGIN
  SELECT *
  INTO v_transfer
  FROM public.transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer not found';
  END IF;

  IF v_transfer.status = 'posted' THEN
    RETURN v_transfer;
  END IF;

  IF v_transfer.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft transfers can be posted';
  END IF;

  SELECT *
  INTO v_from
  FROM public.accounts
  WHERE id = v_transfer.from_account_id;

  SELECT *
  INTO v_to
  FROM public.accounts
  WHERE id = v_transfer.to_account_id;

  PERFORM public.validate_transfer_accounts(
    v_transfer.district_id,
    v_transfer.from_account_id,
    v_transfer.to_account_id
  );

  v_reference := COALESCE(v_transfer.reference_no, public.next_transfer_number(v_transfer.district_id));

  INSERT INTO public.cashbook_transactions (
    district_id,
    account_id,
    fund_id,
    source_id,
    transfer_id,
    kind,
    effect_direction,
    status,
    transaction_date,
    reference_number,
    counterparty,
    narration,
    currency,
    total_amount,
    created_by,
    submitted_by,
    approved_by,
    posted_by,
    submitted_at,
    approved_at,
    posted_at
  ) VALUES (
    v_transfer.district_id,
    v_transfer.from_account_id,
    NULL,
    NULL,
    v_transfer.id,
    'transfer',
    'out',
    'posted',
    v_transfer.transfer_date,
    v_reference,
    v_to.name,
    COALESCE(NULLIF(btrim(v_transfer.description), ''), 'Transfer to ' || v_to.name),
    v_from.currency,
    v_transfer.amount,
    v_transfer.captured_by_user_id,
    p_actor_id,
    p_actor_id,
    p_actor_id,
    v_now,
    v_now,
    v_now
  );

  INSERT INTO public.cashbook_transactions (
    district_id,
    account_id,
    fund_id,
    source_id,
    transfer_id,
    kind,
    effect_direction,
    status,
    transaction_date,
    reference_number,
    counterparty,
    narration,
    currency,
    total_amount,
    created_by,
    submitted_by,
    approved_by,
    posted_by,
    submitted_at,
    approved_at,
    posted_at
  ) VALUES (
    v_transfer.district_id,
    v_transfer.to_account_id,
    NULL,
    NULL,
    v_transfer.id,
    'transfer',
    'in',
    'posted',
    v_transfer.transfer_date,
    v_reference,
    v_from.name,
    COALESCE(NULLIF(btrim(v_transfer.description), ''), 'Transfer from ' || v_from.name),
    v_to.currency,
    v_transfer.amount,
    v_transfer.captured_by_user_id,
    p_actor_id,
    p_actor_id,
    p_actor_id,
    v_now,
    v_now,
    v_now
  );

  UPDATE public.transfers
  SET
    status = 'posted',
    reference_no = v_reference,
    posted_by_user_id = p_actor_id,
    posted_at = v_now
  WHERE id = v_transfer.id
  RETURNING * INTO v_transfer;

  RETURN v_transfer;
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_transfer(
  p_transfer_id UUID,
  p_actor_id UUID,
  p_narration TEXT DEFAULT NULL
)
RETURNS public.transfers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer            public.transfers%ROWTYPE;
  v_out_txn             public.cashbook_transactions%ROWTYPE;
  v_in_txn              public.cashbook_transactions%ROWTYPE;
  v_now                 TIMESTAMPTZ := NOW();
  v_reversal_reference  TEXT;
  v_reversal_narration  TEXT;
BEGIN
  SELECT *
  INTO v_transfer
  FROM public.transfers
  WHERE id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer not found';
  END IF;

  IF v_transfer.status = 'reversed' THEN
    RETURN v_transfer;
  END IF;

  IF v_transfer.status <> 'posted' THEN
    RAISE EXCEPTION 'Only posted transfers can be reversed';
  END IF;

  SELECT *
  INTO v_out_txn
  FROM public.cashbook_transactions
  WHERE transfer_id = v_transfer.id
    AND source_transaction_id IS NULL
    AND effect_direction = 'out'
  ORDER BY created_at
  LIMIT 1;

  SELECT *
  INTO v_in_txn
  FROM public.cashbook_transactions
  WHERE transfer_id = v_transfer.id
    AND source_transaction_id IS NULL
    AND effect_direction = 'in'
  ORDER BY created_at
  LIMIT 1;

  IF v_out_txn.id IS NULL OR v_in_txn.id IS NULL THEN
    RAISE EXCEPTION 'Transfer effect rows are missing';
  END IF;

  v_reversal_reference := COALESCE(v_transfer.reference_no, public.next_transfer_number(v_transfer.district_id)) || '-REV';
  v_reversal_narration := COALESCE(NULLIF(btrim(p_narration), ''), 'Reversal of ' || COALESCE(v_transfer.reference_no, v_transfer.id::TEXT));

  INSERT INTO public.cashbook_transactions (
    district_id,
    account_id,
    fund_id,
    source_id,
    transfer_id,
    kind,
    effect_direction,
    status,
    transaction_date,
    reference_number,
    counterparty,
    narration,
    currency,
    total_amount,
    source_transaction_id,
    created_by,
    submitted_by,
    approved_by,
    posted_by,
    submitted_at,
    approved_at,
    posted_at
  ) VALUES (
    v_out_txn.district_id,
    v_out_txn.account_id,
    NULL,
    NULL,
    v_transfer.id,
    'reversal',
    'in',
    'posted',
    CURRENT_DATE,
    v_reversal_reference,
    v_out_txn.counterparty,
    v_reversal_narration,
    v_out_txn.currency,
    v_out_txn.total_amount,
    v_out_txn.id,
    p_actor_id,
    p_actor_id,
    p_actor_id,
    p_actor_id,
    v_now,
    v_now,
    v_now
  );

  INSERT INTO public.cashbook_transactions (
    district_id,
    account_id,
    fund_id,
    source_id,
    transfer_id,
    kind,
    effect_direction,
    status,
    transaction_date,
    reference_number,
    counterparty,
    narration,
    currency,
    total_amount,
    source_transaction_id,
    created_by,
    submitted_by,
    approved_by,
    posted_by,
    submitted_at,
    approved_at,
    posted_at
  ) VALUES (
    v_in_txn.district_id,
    v_in_txn.account_id,
    NULL,
    NULL,
    v_transfer.id,
    'reversal',
    'out',
    'posted',
    CURRENT_DATE,
    v_reversal_reference,
    v_in_txn.counterparty,
    v_reversal_narration,
    v_in_txn.currency,
    v_in_txn.total_amount,
    v_in_txn.id,
    p_actor_id,
    p_actor_id,
    p_actor_id,
    p_actor_id,
    v_now,
    v_now,
    v_now
  );

  UPDATE public.cashbook_transactions
  SET
    status = 'reversed',
    reversed_by = p_actor_id,
    reversed_at = v_now
  WHERE id IN (v_out_txn.id, v_in_txn.id)
    AND status = 'posted';

  UPDATE public.transfers
  SET
    status = 'reversed',
    reversed_by_user_id = p_actor_id,
    reversed_at = v_now
  WHERE id = v_transfer.id
  RETURNING * INTO v_transfer;

  RETURN v_transfer;
END;
$$;
