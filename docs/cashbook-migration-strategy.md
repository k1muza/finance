# Cashbook Migration Strategy

## Overview

The app is transitioning from a simple income/expenses model to a full cashbook engine. This document captures the strategy, backup checklist, and rollback plan so no historical finance data is lost during the transition.

## Guiding Principle

Keep the existing `income` and `expenses` tables alive as the source of truth until Phase 7 (Legacy Migration). The new cashbook engine is additive. No existing write path is removed until the data migration is verified.

---

## Pre-Migration Backup Checklist

Run these steps before applying any cashbook migration to production:

1. **Supabase dashboard snapshot**
   - Go to Project Settings > Database > Backups
   - Confirm the most recent automatic backup is less than 24 hours old
   - Trigger a manual backup if needed (available on Pro plan)

2. **Local pg_dump** (replace with your connection string):
   ```bash
   pg_dump \
     --no-acl \
     --no-owner \
     -Fc \
     "$DATABASE_URL" \
     -f "backup-$(date +%Y%m%d-%H%M%S).dump"
   ```

3. **Record current row counts** before migrating:
   ```sql
   SELECT
     (SELECT count(*) FROM public.income)    AS income_rows,
     (SELECT count(*) FROM public.expenses)  AS expense_rows,
     (SELECT count(*) FROM public.accounts)  AS account_rows,
     (SELECT count(*) FROM public.funds)     AS fund_rows;
   ```
   Save the output. Verify it matches after migration.

4. **Apply the migration** to a staging environment first, run the app against it, confirm no regressions, then apply to production.

---

## Migration Rollback Plan

If a migration must be rolled back:

1. Restore from the pg_dump taken in step 2 above:
   ```bash
   pg_restore \
     --no-acl \
     --no-owner \
     -d "$DATABASE_URL" \
     backup-<timestamp>.dump
   ```

2. If restoration is not feasible (production with live traffic), the preferred approach is to write a compensating migration that drops only the new objects added in the offending migration. The existing `income` and `expenses` tables are never touched by cashbook migrations until Phase 7, so a partial rollback is always possible.

---

## Phase 7 Cutover Plan (future)

When the cashbook engine has been stable for 30+ days:

1. Write and test a backfill script that imports `income` and `expenses` rows into `cashbook_transactions` as posted receipts and payments.
2. Run a validation script that compares totals by district, fund, currency, and date range between old and new models. Totals must match before cutover.
3. Make legacy income/expenditure screens read-only.
4. Switch reports to the new data model.
5. Archive the old write hooks (`useIncome.add`, `useExpenses.add`).

---

## Hard-Delete Policy

**Never hard-delete a posted or approved cashbook transaction.**

- `draft` records: hard delete is allowed
- `submitted` / `approved` records: step back through the workflow; do not delete
- `posted` records: use reversal only; the database trigger `trg_cashbook_immutability` will reject any direct delete attempt
- `reversed` / `voided` records: immutable; no further action possible
