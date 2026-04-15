# Production Cashbook Backlog

## Objective

Turn the current district finance dashboard into a production-ready cashbook that supports:

- account-based cash management
- auditable transaction history
- approvals and posting controls
- reconciliation
- locked periods
- attachments and references
- safer reporting and exports

This backlog is written for the current codebase in this repository, not for a greenfield rewrite.

## Current Baseline In This Repo

The app already has a strong finance foundation:

- district-scoped auth and RLS
- income and expenditure capture
- funds and budgets
- multi-currency and payment method fields
- CSV import
- CSV, PDF, and DOCX exports

Relevant current touchpoints:

- `supabase/schema.sql`
- `supabase/migrations/20260415000000_add_currency_and_payment_method.sql`
- `src/types/index.ts`
- `src/hooks/useIncome.ts`
- `src/hooks/useExpenses.ts`
- `src/hooks/useOverview.ts`
- `src/app/dashboard/finance/income/page.tsx`
- `src/app/dashboard/finance/expenditure/page.tsx`
- `src/app/dashboard/finance/reports/page.tsx`
- `src/components/settings/SettingsPanel.tsx`
- `src/contexts/AuthContext.tsx`

Current production gaps:

- no `accounts` layer for cash box, bank account, EcoCash wallet, or petty cash
- no opening and closing balances per account
- no transfer workflow between accounts
- no posting lifecycle such as draft, approved, posted, reversed
- no audit trail fields or audit log table
- no attachment storage for receipts, invoices, deposit slips, or vouchers
- current writes happen directly from the browser via Supabase client hooks
- current finance records can be hard-deleted
- roles are limited to `admin` and `district`
- no reconciliation workflow
- no period close and period lock model
- no automated test suite or CI workflow in the repo

## Recommended Target Architecture

Do not keep scaling production cashbook behavior by adding more columns onto `income` and `expenses`.

Recommended direction:

- keep `funds` as the "purpose of money" dimension
- add `accounts` as the "where the money sits" dimension
- add a new transaction model for the cashbook
- migrate current reports to derive from the new transaction model
- keep the existing income and expenditure pages alive only as transitional compatibility surfaces

Recommended new database objects:

- `accounts`
- `account_opening_balances`
- `cashbook_transactions`
- `cashbook_transaction_lines`
- `cashbook_attachments`
- `cashbook_audit_log`
- `financial_periods`
- `approval_rules` or `transaction_approvals`

Recommended key enums:

- `account_type`: `cash`, `bank`, `mobile_money`, `petty_cash`
- `transaction_kind`: `receipt`, `payment`, `transfer`, `adjustment`, `opening_balance`, `reversal`
- `transaction_status`: `draft`, `submitted`, `approved`, `posted`, `reversed`, `voided`
- `attachment_type`: `receipt`, `invoice`, `voucher`, `deposit_slip`, `proof_of_transfer`, `other`

Recommended design rules:

- posted transactions must be immutable
- corrections happen through reversal and replacement, not destructive edit
- hard delete is allowed only for draft records, if at all
- transfers must create balanced account movement
- account balances should come from posted lines, not from cached totals in the client
- client components should stop writing directly to finance tables
- server routes or database functions should own posting, approval, reversal, and transfer logic

## Delivery Phases

### Phase 0: Foundations And Safety Rails

Goal: prepare the repo so we can add a real cashbook without risking current finance data.

Backlog:

- [ ] Add a feature flag for the new cashbook flow, such as `NEXT_PUBLIC_CASHBOOK_V2_ENABLED`
- [ ] Document the migration and rollback strategy before changing finance writes
- [ ] Add a pre-migration database backup checklist to the repo
- [ ] Add a `docs/finance-data-model.md` ERD once the target schema is approved
- [ ] Add test tooling and a CI workflow for lint plus at least one database or route smoke test
- [ ] Add a finance coding rule in the repo docs: no hard delete for posted records

Touchpoints:

- `.env.example`
- `README.md`
- `package.json`
- `.github/workflows/*`
- `docs/*`

Acceptance criteria:

- a developer can enable or disable the new cashbook flow without breaking current pages
- migration, rollback, and backup steps are written down in the repo
- at least one automated check runs on pull requests

### Phase 1: Accounts And Opening Balances

Goal: introduce account-based cash management without yet replacing the legacy entry screens.

Backlog:

- [ ] Add `accounts` table with district scope, name, type, currency, code, status, and optional notes
- [ ] Add unique constraints per district for account name or code
- [ ] Add `account_opening_balances` table keyed by account and effective date
- [ ] Add `is_default` or `sort_order` support for account selection in the UI
- [ ] Add server-side validation so account currency and transaction currency cannot conflict
- [ ] Add account RLS policies parallel to current district finance policies
- [ ] Add TypeScript types for `Account` and `AccountOpeningBalance`
- [ ] Add settings UI for account creation, edit, archive, and opening balance setup

Touchpoints:

- `supabase/migrations/*`
- `supabase/schema.sql`
- `src/types/index.ts`
- `src/components/settings/SettingsPanel.tsx`
- `src/contexts/AuthContext.tsx`
- new hooks such as `src/hooks/useAccounts.ts`

Acceptance criteria:

- each district can maintain multiple cashbook accounts
- accounts can be archived without breaking historical reports
- opening balances are stored per account and date
- archived accounts cannot be used for new postings

### Phase 2: Cashbook Transaction Engine

Goal: create the durable transaction model that production reporting and balances will rely on.

Backlog:

- [ ] Add `cashbook_transactions` header table
- [ ] Add `cashbook_transaction_lines` detail table
- [ ] Include fields for district, account, fund, category, currency, amount, transaction date, reference number, counterparty, narration, and status
- [ ] Include workflow fields such as `created_by`, `submitted_by`, `approved_by`, `posted_by`, `reversed_by`, `posted_at`, and `reversed_at`
- [ ] Add `source_transaction_id` for reversals
- [ ] Add transaction numbering with district-scoped sequences
- [ ] Add database functions or RPCs for draft creation, submission, approval, posting, reversal, and account transfer
- [ ] Prevent direct update or delete of posted rows via RLS or trigger checks
- [ ] Add `cashbook_audit_log` trigger table capturing inserts, status changes, reversals, and protected field edits

Touchpoints:

- `supabase/migrations/*`
- `supabase/schema.sql`
- `src/types/index.ts`
- new API routes under `src/app/api/cashbook/*`
- new hooks such as `src/hooks/useCashbook.ts`

Acceptance criteria:

- the system can record receipt, payment, transfer, adjustment, opening balance, and reversal transactions
- posted transactions cannot be hard-edited from the client
- every state transition records who performed it and when
- account balance can be computed from posted transaction lines only

### Phase 3: Roles, Approval Flow, And Period Locking

Goal: add the internal controls that make the cashbook trustworthy.

Backlog:

- [ ] Expand `profiles.role` beyond `admin` and `district`
- [ ] Expand roles to `admin`, `district_treasurer`, `district_approver`, and `district_viewer`
- [ ] Add `financial_periods` table with start date, end date, closed flag, closed_by, and closed_at
- [ ] Prevent posting into closed periods
- [ ] Add approval requirements by transaction kind or amount threshold
- [ ] Add queue screens for submitted and pending approval items
- [ ] Add read-only access for viewers
- [ ] Update auth context and navigation to support the new roles cleanly

Touchpoints:

- `supabase/migrations/*`
- `supabase/schema.sql`
- `src/contexts/AuthContext.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/TopBar.tsx`
- dashboard route guards

Acceptance criteria:

- a preparer cannot approve their own transaction unless explicitly allowed
- closed periods reject new postings
- viewers can inspect but cannot mutate finance data
- approval rules are enforced in the database, not only in the UI

### Phase 4: Cashbook UI Cutover

Goal: replace direct income and expenditure CRUD with production cashbook workflows.

Backlog:

- [ ] Add `/dashboard/finance/cashbook` register page
- [ ] Add `/dashboard/finance/accounts` page with balance cards and account filters
- [ ] Build a unified transaction form covering receipts, payments, transfers, adjustments, and reversals
- [ ] Add transaction drawer or detail page showing lifecycle history
- [ ] Add draft, submit, approve, post, and reverse actions in the UI
- [ ] Replace direct `useIncome` and `useExpenses` writes with server calls
- [ ] Make legacy income and expenditure screens read-only or route them through the new transaction engine
- [ ] Add better filters: account, fund, category, date range, status, currency, counterparty, reference

Touchpoints:

- new pages under `src/app/dashboard/finance/*`
- `src/app/dashboard/finance/layout.tsx`
- `src/components/ui/*`
- new hooks for accounts and cashbook registers
- existing `src/app/dashboard/finance/income/page.tsx`
- existing `src/app/dashboard/finance/expenditure/page.tsx`

Acceptance criteria:

- a finance user can run daily cashbook work from the new register without touching legacy pages
- no production finance write path depends on direct browser table mutation
- the register can show opening balance, movement, and closing balance by account and date range

### Phase 5: Attachments, References, And Supporting Evidence

Goal: make each financial record supportable during audit or review.

Backlog:

- [ ] Add Supabase Storage bucket for finance documents
- [ ] Add `cashbook_attachments` metadata table
- [ ] Support upload of receipts, invoices, deposit slips, and proof of transfer
- [ ] Add attachment permissions so only authorized users can download or replace files
- [ ] Add receipt number, voucher number, bank reference, and external transaction ID fields
- [ ] Add UI previews and download links on transaction detail pages

Touchpoints:

- `supabase/config.toml`
- `supabase/migrations/*`
- new storage policies
- `src/app/api/cashbook/*`
- new attachment components under `src/components/*`

Acceptance criteria:

- posted transactions can retain one or more supporting files
- attachments are district-scoped and permission-controlled
- every receipt or payment can store internal and external references

### Phase 6: Reconciliation And Control Reports

Goal: let finance users prove the cashbook matches reality.

Backlog:

- [ ] Add bank reconciliation workflow with statement opening balance, statement closing balance, and unreconciled items
- [ ] Add cash count workflow for physical cash accounts
- [ ] Add transfer mismatch and stale draft reports
- [ ] Add daily cashbook report per account
- [ ] Add account statement report with opening balance, running balance, and closing balance
- [ ] Add reconciliation status report
- [ ] Update existing reports page so fund balances and budget comparisons can drill into account-backed transactions

Touchpoints:

- `src/app/dashboard/finance/reports/page.tsx`
- `src/lib/finance/reporting.ts`
- new reconciliation pages and hooks
- database views or RPCs for performant balance queries

Acceptance criteria:

- users can reconcile a bank account against a statement period
- users can produce an account statement with running balance
- reports derive from posted transactions and opening balances

### Phase 7: Legacy Migration And Deprecation

Goal: move the app from the old finance model to the new one without losing continuity.

Backlog:

- [ ] Decide migration strategy: either backfill current `income` and `expenses` into `cashbook_transactions`, or keep them as legacy sources behind compatibility views during transition
- [ ] Write a migration script for historical data
- [ ] Preserve legacy record identifiers where possible
- [ ] Add a data validation script to compare old totals and new totals by district, fund, currency, and date range
- [ ] Switch reports to the new data model after totals match
- [ ] Freeze legacy delete paths
- [ ] Archive or remove old write hooks once cutover is complete

Touchpoints:

- `scripts/*`
- `supabase/migrations/*`
- `src/hooks/useIncome.ts`
- `src/hooks/useExpenses.ts`
- `src/app/dashboard/finance/reports/page.tsx`

Acceptance criteria:

- historical totals reconcile between old and new models
- legacy screens no longer expose unsafe write behavior
- the cutover can be verified with repeatable scripts

## Cross-Cutting Engineering Backlog

These items should be worked throughout the phases above:

- [ ] Add unit tests for balance and reversal logic
- [ ] Add integration tests for posting, approval, transfer, and reversal routes
- [ ] Add migration tests for historical backfill
- [ ] Add import idempotency checks so repeated CSV uploads do not duplicate production data
- [ ] Add error monitoring and structured logging for finance operations
- [ ] Add performance checks for report queries on larger datasets
- [ ] Add seed data for accounts, opening balances, and realistic transaction flows
- [ ] Add explicit currency and account consistency validation everywhere data enters the system

## Immediate Priorities

If work starts now, build in this order:

1. Accounts and opening balances
2. Cashbook transaction engine with immutable posting and reversal
3. Roles, approval flow, and period locking
4. New cashbook register UI
5. Attachments and reconciliation
6. Legacy migration and report cutover

## Recommended First Milestone

The best first implementation slice for this repo is:

1. Add `accounts`
2. Add `account_opening_balances`
3. Add `cashbook_transactions`
4. Add `cashbook_transaction_lines`
5. Add audit fields and audit log triggers
6. Add server-side post and reverse actions
7. Add a simple cashbook register page for one district-scoped account view

Do not start with attachments or reconciliation first. Those will be much easier once account balances and immutable posted transactions exist.

## Out Of Scope For The First Cashbook Release

These are useful later, but they should not block the first production cashbook version:

- full general ledger and chart of accounts
- accounts payable automation
- accounts receivable invoicing
- payroll
- fixed asset register
- tax engine
