-- ============================================================
-- Cashbook Engine — Phase 2
-- ============================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE public.transaction_kind AS ENUM (
    'receipt',
    'payment',
    'transfer',
    'adjustment',
    'opening_balance',
    'reversal'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.transaction_status AS ENUM (
    'draft',
    'submitted',
    'approved',
    'posted',
    'reversed',
    'voided'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- District-scoped transaction number sequences
-- ============================================================

CREATE TABLE IF NOT EXISTS public.district_transaction_sequences (
  district_id UUID NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  year        SMALLINT NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (district_id, year)
);

-- No client access needed — accessed only via the function below
ALTER TABLE public.district_transaction_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "no_client_access_sequences" ON public.district_transaction_sequences;
CREATE POLICY "no_client_access_sequences" ON public.district_transaction_sequences
  FOR ALL USING (false);

-- Atomically increment and return the next reference number for a district
CREATE OR REPLACE FUNCTION public.next_transaction_number(p_district_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year  SMALLINT := EXTRACT(YEAR FROM NOW())::SMALLINT;
  v_next  INTEGER;
BEGIN
  INSERT INTO public.district_transaction_sequences (district_id, year, last_number)
  VALUES (p_district_id, v_year, 1)
  ON CONFLICT (district_id, year) DO UPDATE
    SET last_number = district_transaction_sequences.last_number + 1
  RETURNING last_number INTO v_next;

  RETURN 'TXN-' || v_year || '-' || LPAD(v_next::TEXT, 4, '0');
END;
$$;

-- ============================================================
-- cashbook_transactions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cashbook_transactions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id            UUID NOT NULL REFERENCES public.districts(id) ON DELETE RESTRICT,
  account_id             UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  fund_id                UUID REFERENCES public.funds(id) ON DELETE SET NULL,
  kind                   public.transaction_kind NOT NULL,
  status                 public.transaction_status NOT NULL DEFAULT 'draft',
  transaction_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  reference_number       TEXT,
  counterparty           TEXT,
  narration              TEXT,
  currency               public.currency_code NOT NULL,
  total_amount           NUMERIC(12, 2) NOT NULL CHECK (total_amount > 0),
  source_transaction_id  UUID REFERENCES public.cashbook_transactions(id) ON DELETE RESTRICT,
  created_by             UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  submitted_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  posted_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reversed_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at           TIMESTAMPTZ,
  approved_at            TIMESTAMPTZ,
  posted_at              TIMESTAMPTZ,
  reversed_at            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cashbook_txn_district
  ON public.cashbook_transactions(district_id);
CREATE INDEX IF NOT EXISTS idx_cashbook_txn_account
  ON public.cashbook_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_cashbook_txn_district_status
  ON public.cashbook_transactions(district_id, status);
CREATE INDEX IF NOT EXISTS idx_cashbook_txn_district_date
  ON public.cashbook_transactions(district_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_cashbook_txn_account_status
  ON public.cashbook_transactions(account_id, status);
CREATE INDEX IF NOT EXISTS idx_cashbook_txn_source
  ON public.cashbook_transactions(source_transaction_id)
  WHERE source_transaction_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_cashbook_txn_updated_at ON public.cashbook_transactions;
CREATE TRIGGER trg_cashbook_txn_updated_at
  BEFORE UPDATE ON public.cashbook_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Immutability trigger — posted/reversed/voided rows are locked
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_posted_transaction_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status IN ('posted', 'reversed', 'voided') THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Cannot delete a % transaction. Use reversal instead.', OLD.status;
    END IF;

    -- A posted transaction may only move to reversed or voided
    IF OLD.status = 'posted' AND NEW.status NOT IN ('reversed', 'voided') THEN
      RAISE EXCEPTION 'Cannot modify a posted transaction. Use reversal instead.';
    END IF;

    -- Reversed and voided are terminal
    IF OLD.status IN ('reversed', 'voided') THEN
      RAISE EXCEPTION 'Cannot modify a % transaction.', OLD.status;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_cashbook_immutability ON public.cashbook_transactions;
CREATE TRIGGER trg_cashbook_immutability
  BEFORE UPDATE OR DELETE ON public.cashbook_transactions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_posted_transaction_mutation();

-- ============================================================
-- cashbook_transaction_lines
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cashbook_transaction_lines (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.cashbook_transactions(id) ON DELETE CASCADE,
  account_id     UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  fund_id        UUID REFERENCES public.funds(id) ON DELETE SET NULL,
  category       TEXT,
  amount         NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  direction      TEXT NOT NULL CHECK (direction IN ('debit', 'credit')),
  narration      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cashbook_lines_transaction
  ON public.cashbook_transaction_lines(transaction_id);
CREATE INDEX IF NOT EXISTS idx_cashbook_lines_account
  ON public.cashbook_transaction_lines(account_id);

-- ============================================================
-- cashbook_audit_log
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cashbook_audit_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.cashbook_transactions(id) ON DELETE CASCADE,
  actor_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action         TEXT NOT NULL,
  old_status     public.transaction_status,
  new_status     public.transaction_status,
  details        JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cashbook_audit_transaction
  ON public.cashbook_audit_log(transaction_id);
CREATE INDEX IF NOT EXISTS idx_cashbook_audit_created
  ON public.cashbook_audit_log(created_at DESC);

-- ============================================================
-- Audit trigger — writes to cashbook_audit_log automatically
-- ============================================================

CREATE OR REPLACE FUNCTION public.log_cashbook_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.cashbook_audit_log (transaction_id, actor_id, action, new_status)
    VALUES (NEW.id, NEW.created_by, 'created', NEW.status);
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.cashbook_audit_log (transaction_id, actor_id, action, old_status, new_status)
    VALUES (
      NEW.id,
      auth.uid(),
      CASE NEW.status
        WHEN 'submitted' THEN 'submitted'
        WHEN 'approved'  THEN 'approved'
        WHEN 'posted'    THEN 'posted'
        WHEN 'reversed'  THEN 'reversed'
        WHEN 'voided'    THEN 'voided'
        ELSE 'status_changed'
      END,
      OLD.status,
      NEW.status
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cashbook_audit ON public.cashbook_transactions;
CREATE TRIGGER trg_cashbook_audit
  AFTER INSERT OR UPDATE ON public.cashbook_transactions
  FOR EACH ROW EXECUTE FUNCTION public.log_cashbook_status_change();

-- ============================================================
-- RLS — cashbook_transactions
-- ============================================================

ALTER TABLE public.cashbook_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_cashbook_transactions" ON public.cashbook_transactions;
DROP POLICY IF EXISTS "district_manage_own_cashbook_transactions" ON public.cashbook_transactions;

CREATE POLICY "admin_manage_cashbook_transactions" ON public.cashbook_transactions
  FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE POLICY "district_manage_own_cashbook_transactions" ON public.cashbook_transactions
  FOR ALL
  USING (district_id = public.current_district_id())
  WITH CHECK (district_id = public.current_district_id());

-- ============================================================
-- RLS — cashbook_transaction_lines
-- ============================================================

ALTER TABLE public.cashbook_transaction_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_cashbook_lines" ON public.cashbook_transaction_lines;
DROP POLICY IF EXISTS "district_read_own_cashbook_lines" ON public.cashbook_transaction_lines;

CREATE POLICY "admin_manage_cashbook_lines" ON public.cashbook_transaction_lines
  FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- District users can read lines that belong to their district's transactions
CREATE POLICY "district_read_own_cashbook_lines" ON public.cashbook_transaction_lines
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cashbook_transactions t
      WHERE t.id = transaction_id
        AND t.district_id = public.current_district_id()
    )
  );

-- District users can insert/update/delete lines only on draft transactions
CREATE POLICY "district_write_draft_cashbook_lines" ON public.cashbook_transaction_lines
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cashbook_transactions t
      WHERE t.id = transaction_id
        AND t.district_id = public.current_district_id()
        AND t.status = 'draft'
    )
  );

CREATE POLICY "district_delete_draft_cashbook_lines" ON public.cashbook_transaction_lines
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.cashbook_transactions t
      WHERE t.id = transaction_id
        AND t.district_id = public.current_district_id()
        AND t.status = 'draft'
    )
  );

-- ============================================================
-- RLS — cashbook_audit_log (read-only from client)
-- ============================================================

ALTER TABLE public.cashbook_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_all_audit" ON public.cashbook_audit_log;
DROP POLICY IF EXISTS "district_read_own_audit" ON public.cashbook_audit_log;

CREATE POLICY "admin_read_all_audit" ON public.cashbook_audit_log
  FOR SELECT USING (public.is_admin_user());

CREATE POLICY "district_read_own_audit" ON public.cashbook_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cashbook_transactions t
      WHERE t.id = transaction_id
        AND t.district_id = public.current_district_id()
    )
  );
