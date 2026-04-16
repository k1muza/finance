-- ============================================================
-- B3.1 + B8.1: Add offline idempotency fields to cashbook_transactions
--
-- client_generated_id: UUID set by the client before the record is
--   submitted. Used as an idempotency key during offline-sync replay so
--   that a retried create does not insert a duplicate row.
--
-- device_id: opaque device identifier set by the client. Used for
--   diagnostics and conflict attribution during reconnect sync.
--
-- source_id will be added in a later migration once the sources table
-- exists (backlog item B2.5).
-- ============================================================

ALTER TABLE public.cashbook_transactions
  ADD COLUMN IF NOT EXISTS client_generated_id UUID,
  ADD COLUMN IF NOT EXISTS device_id           TEXT;

-- Platform-wide uniqueness: no two transactions (across all districts)
-- may share the same client_generated_id.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cashbook_txn_client_id
  ON public.cashbook_transactions (client_generated_id)
  WHERE client_generated_id IS NOT NULL;
