# District Church Accounting Backlog

Derived from [district_church_accounting_engineering_spec_v2_3_radix.md](/c:/Users/k1muz/projects/finance/docs/district_church_accounting_engineering_spec_v2_3_radix.md) and the current repository state as of 2026-04-16.

## Purpose

This backlog translates the v2.3 engineering spec into implementation work for the existing finance app. It assumes we are evolving the current codebase rather than starting from scratch.

## Working assumptions

These assumptions unblock backlog sequencing. If any of them change, the affected items should be re-scoped before implementation starts.

1. A user can belong to multiple districts from the first release of the new model.
2. District creation should auto-seed one default fund and one root `DISTRICT` member.
3. Anonymous receipts are allowed, but only through an explicit placeholder member or flagged workflow.
4. Budget member-scoping is deferred for the first release; fund and currency scoping come first.
5. Superuser district-context switching is allowed, but it must be clearly indicated in UI and logged server-side.

## Current baseline

What already exists in the repo:

- District entity and self-service district creation
- Basic auth and route protection
- Accounts, funds, opening balances, and flat budgets
- Cashbook tables, audit log, immutability trigger, and submit/approve/post/reverse routes
- Income and expenditure CRUD, import flows, and legacy reporting
- Basic offline-friendly caching and service worker registration

Main gaps or mismatches against the v2.3 spec:

- Access control still uses `profiles` with `admin` or `district`; the spec requires `user_profiles` plus `district_users`
- The create transaction API currently auto-posts new transactions instead of preserving a safe draft-first workflow
- `members`, `counterparties`, `transfers`, `budget_lines`, `attachments`, and district membership management are missing
- Budgets are still modeled as flat category rows, not budget headers with lifecycle and lines
- Reports and exports are still centered on legacy `income` and `expenses` rather than posted cashbook transactions
- Offline support is cache-oriented today; there is no durable draft queue, sync engine, or conflict handling
- There is no visible automated test suite for the new accounting engine
- The current settings area still includes destructive district deletion, which is unsafe once districts hold operational accounting history

## Priority legend

- `P0`: Must happen before serious rollout of the new accounting model
- `P1`: Core release scope
- `P2`: Important follow-up after core flows are stable
- `P3`: Nice to have or operational polish

## Phase 0: Alignment and safety rails

### B0.1 `P0` ✅ Decide the target migration strategy

Define whether `income` and `expenses` become read-only legacy data, are backfilled into `cashbook_transactions`, or coexist temporarily behind separate UI sections.

Done when:
- we have a written cutover strategy
- the source of truth for balances and reports is explicit
- data migration and rollback expectations are documented

### B0.2 `P0` ✅ Stop auto-posting on transaction creation

Change `POST /api/cashbook/transactions` so new transactions are saved as `draft` by default and only receive reference numbers on posting.

Done when:
- draft creation no longer sets `submitted_at`, `approved_at`, or `posted_at`
- posting remains the only place reference numbers are assigned
- existing submit, approve, and post routes are exercised end to end

### B0.3 `P0` ✅ Remove destructive operational delete paths

Harden UI and backend paths that can currently remove districts or operational finance records in ways that violate the accounting model.

Done when:
- district deletion is disabled or replaced with deactivation
- posted and approved finance records are never hard-deleted from app flows
- draft-only delete behavior is explicit in UI copy and server logic

### B0.4 `P0` ✅ Define role matrix and protected workflow ownership

Translate spec roles into an implementation-ready permission matrix for district setup, transaction preparation, approval, posting, reversal, reporting, and export.

Done when:
- each action maps to a district role or superuser
- approval segregation rules are explicit
- RLS and route checks can be derived from the matrix

### B0.5 `P0` ✅ Add a thin automated test harness

Introduce the minimum test stack needed for unit and integration coverage around the accounting engine.

Done when:
- the repo can run automated tests locally and in CI
- at least one database or route test proves the harness works
- backlog items can add tests incrementally without tooling rework

## Phase 1A: Tenant and identity foundation

### B1.1 `P0` ✅ Introduce `user_profiles` and `district_users`

Add the new platform profile and district membership tables, plus migration from the current `profiles` model.

Done when:
- `user_profiles` stores platform metadata including `is_superuser`
- `district_users` supports multiple memberships per user
- existing users can be migrated without losing district access

### B1.2 `P0` ✅ Refactor auth context to district memberships

Update frontend auth and district selection to load accessible districts from memberships rather than a single district on the profile.

Done when:
- a user can belong to more than one district
- current district context is explicit in the UI
- superusers and district users both resolve scope correctly

### B1.3 `P1` ✅ Implement district onboarding flow per spec

Create a safe self-service flow that creates the district, seeds defaults, creates district membership, and lands the creator inside the workspace.

Done when:
- district creation creates the district and the first `district_users` record
- the creator receives the intended district role
- default fund and root district member are seeded automatically

### B1.4 `P1` ✅ Replace current role checks in RLS helpers

Move helper functions like `is_admin_user()` and `current_district_id()` to membership-aware equivalents.

Done when:
- table policies no longer depend on the legacy single-district profile model
- district access is based on active membership
- superuser access is handled centrally

### B1.5 `P1` ✅ Add district user management

Implement listing members, inviting or adding users, role changes, and deactivation.

Done when:
- district admins can manage memberships for their district
- inactive memberships lose access immediately
- membership history is retained for auditability

### B1.6 `P1` âœ… Introduce Zustand app state for district context and sync UI

Adopt Zustand for the shared client-side state the spec assigns to app-level UI, starting with district selection and sync status surfaces.

Done when:
- active district selection is owned by a shared Zustand store rather than isolated component state
- cashbook workspace state can restore the active account and filter drafts per district when the user returns to the page
- sync banner and connectivity state are exposed through the same client store
- backend-backed records remain outside Zustand and keep their own data ownership paths

## Phase 1B: Master data and member hierarchy

### B2.1 `P1` ✅ Expand district metadata

Add spec fields such as `slug`, country, default currency, created-by linkage, and active status.

Done when:
- districts can be referenced safely in exports and URLs
- inactive districts cannot be used for new operations
- creation and edit flows support the required fields

### B2.2 `P1` ✅ Add global currencies table

Replace ad hoc currency handling with a shared currency catalog and district/account defaults.

Done when:
- currencies are stored in a global table
- accounts and districts reference active currencies
- currency-specific validation is server-enforced

### B2.3 `P1` ✅ Align accounts to the new model

Bring accounts up to spec with active flags, sort order, institution details, and refined account types.

Done when:
- account types support the intended operational cases
- account deactivation is supported
- posting refuses inactive accounts

### B2.4 `P1` ✅ Align funds to the new model

Add fund code, nature, active status, and `requires_individual_member`.

Done when:
- funds can distinguish income-only, expense-only, and mixed use
- tithe-like funds can enforce individual member requirements
- inactive funds cannot be used in new drafts or posting

### B2.5 `P1` ✅ Build the `members` hierarchy

Implement the internal member tree for district, region, assembly, individual, and department records.

Done when:
- a district can create and browse a member tree
- parent-child type rules are enforced
- cycles and cross-district parent links are rejected

### B2.6 `P1` ✅ Add member reparenting and hierarchy views

Support practical maintenance of the member tree after initial setup.

Done when:
- users can move members within valid hierarchy rules
- hierarchy views show children and breadcrumbs clearly
- reparenting preserves district isolation

### B2.7 `P1` ✅ Add district counterparties

Introduce a dedicated registry for suppliers and other non-member payees or payers.

Done when:
- a district can create and browse counterparties separately from members
- counterparties remain district-scoped and active/inactive aware
- payment flows can use counterparties without overloading the member hierarchy

## Phase 2: Transaction engine completion

### B3.1 `P0` ✅ Align transaction schema to spec fields

Add missing fields such as `client_generated_id`, `device_id`, `member_id`, `counterparty_id`, and reporting snapshots where required.

Done when:
- transaction rows can support offline idempotency
- transaction rows can reference members or counterparties
- reporting snapshots can be populated on posting

### B3.2 `P1` ✅ Clarify and simplify the transaction lifecycle

Keep the richer district workflow intentionally and document it consistently: `draft` -> `submitted` -> `approved` -> `posted`, with terminal `reversed` and `voided` states.

Done when:
- the schema, routes, and UI all use the same lifecycle
- illegal transitions are blocked uniformly
- the backlog no longer carries ambiguity about approval states

### B3.3 `P1` ✅ Build full draft transaction editing

Allow draft receipts and payments to be edited, validated, and voided before posting.

Done when:
- draft transactions can be updated safely
- draft-only delete or void behavior is supported
- posted records remain immutable except by reversal

### B3.4 `P1` ✅ Add member- and counterparty-aware receipt and payment forms

Capture the correct member or payee, fund, and district-scoped master data at entry time.

Done when:
- receipt and payment forms can select valid members
- payment flows can select registered counterparties
- tithe flows can require `INDIVIDUAL` members
- invalid district or party-type combinations are blocked

### B3.5 `P1` ✅ Populate member snapshots on posting

Store region and assembly snapshots for hierarchy-based reporting at the moment of posting.

Done when:
- tithe reports can aggregate historically even after hierarchy changes
- posting fails when required snapshots cannot be derived
- snapshot values are not editable after posting

### B3.6 `P1` ✅ Add transaction detail, audit, and workflow actions to the UI

Surface submit, approve, post, reverse, and void actions according to permissions.

Done when:
- the cashbook page reflects the real workflow
- users with different roles see only allowed actions
- audit history is visible for each transaction

### B3.7 `P1` ✅ Enforce transaction validation server-side

Consolidate validation for active account, active fund, district ownership, amount, member/counterparty rules, and posting constraints.

Done when:
- protected routes reject invalid or stale data consistently
- error codes are domain-meaningful
- client code does not need to duplicate core integrity rules

### B3.8 `P2` ✅ Normalize or remove legacy income and expenditure CRUD

Retire the duplicate legacy entry flows once the cashbook path fully replaces them.

Done when:
- users have one clear data entry path
- reports do not double-count legacy and cashbook data
- import and export flows target the chosen source of truth

## Phase 3: Transfers and reversals

### B4.1 `P1` ✅ Add the `transfers` aggregate

Create an explicit transfer model instead of treating transfer as only a transaction kind.

Done when:
- transfer records exist separately from effect rows
- a transfer has source account, destination account, amount, status, and metadata
- transfer records stay within one district

### B4.2 `P1` ✅ Implement transfer posting as an atomic workflow

Posting a transfer should create both effect rows or fail entirely.

Done when:
- both accounts must differ and share currency
- transfer posting is transactional and idempotent
- transfer effect rows do not affect fund totals

### B4.3 `P1` ✅ Implement transfer reversal

Reverse a transfer as one logical unit with appropriate linked records.

Done when:
- a posted transfer cannot be reversed twice
- reversal creates the matching compensating effect
- original and reversal records remain traceable

### B4.4 `P2` ✅ Add transfer UI and reporting visibility

Make transfers manageable without polluting receipt or payment views.

Done when:
- users can create, review, post, and reverse transfers in dedicated UI
- account cashbooks show transfer effects correctly
- fund summary reports exclude transfers

## Phase 4: Budget model revamp

### B5.1 `P1` ✅ Split budgets into headers and lines

Move from the current flat budget table to `budgets` plus `budget_lines`.

Done when:
- budget headers hold district, period, and lifecycle state
- budget lines hold fund, currency, optional member scope, and amount
- the old budget UI is replaced with header-aware budget management

### B5.2 `P1` ✅ Add budget lifecycle states

Implement `draft`, `active`, and `closed` with protected state changes.

Done when:
- only draft budgets can be freely edited
- activation and closure use protected server routes
- actuals compare against active or selected budget lines correctly

### B5.3 `P1` ✅ Implement budget-vs-actual from posted transactions

Tie actuals to the same district, period, fund, and currency as the budget line.

Done when:
- actuals ignore drafts and other districts
- variance is computed consistently
- report results can be viewed per selected budget and line

### B5.4 `P2` ✅ Add budget member scoping if still needed

Support optional member-level budgeting after the basic model is stable.

Done when:
- member-scoped budget lines remain district-safe
- actual aggregation respects the member scope
- UI keeps the optionality understandable

## Phase 5: Reporting and exports

### B6.1 `P1` Rebuild cashbook-by-account reporting on posted transactions

Make the account cashbook report the authoritative operational view.

Done when:
- running balance is computed from opening balance plus posted movements
- filters cover district, account, and date range
- report rows include status and posted metadata

### B6.2 `P1` Build tithe reports by individual, assembly, and region

Use member snapshots captured on posting for historical consistency.

Done when:
- individual tithe totals can be listed
- assembly and region rollups aggregate from snapshots
- hierarchy changes after posting do not rewrite history

### B6.3 `P1` Build fund summary and account balance reports

Support day-to-day oversight of funds and account positions.

Done when:
- fund summary excludes transfers
- account balance views derive from posted transactions
- district scoping is enforced end to end

### B6.4 `P1` Generate the monthly cashbook spreadsheet export

Create the required server-side spreadsheet export for a district account and month.

Done when:
- export output matches the spec columns
- filename uses district slug, account name, and year-month
- opening balance and running balance are computed correctly

### B6.5 `P2` Add export history and retrieval

Store generated exports and make them discoverable later if needed.

Done when:
- exports can be listed per district
- access respects district membership
- repeated export generation does not leak across tenants

## Phase 6: Attachments and offline-first operation

### B7.1 `P2` Add attachments model and storage rules

Support linking receipts or supporting files to district records.

Done when:
- attachments carry `district_id`
- storage paths and access rules respect district isolation
- uploads can be associated with transactions or budgets

### B7.2 `P1` Design and implement the offline queue

Move from cache-only behavior to a durable local queue for draft capture.

Done when:
- queued items store operation id, district id, operation type, payload, retry state, and timestamps
- queued items survive reloads
- queue entries are bound to the district they were created under

### B7.3 `P1` Support offline draft creation for transactions, transfers, and budgets

Let users keep working offline without allowing balance-affecting actions.

Done when:
- draft receipt, payment, transfer, budget, and budget-line creation can happen offline
- post, reverse, activate, and close actions are blocked offline
- UI makes the limitation obvious

### B7.4 `P1` Build reconnect sync and conflict handling

Replay queued changes safely when the device comes back online.

Done when:
- queue items are processed in order
- sync uses `client_generated_id` for idempotent create semantics
- failed items are marked `FAILED` or `CONFLICT` and need user intervention

### B7.5 `P2` Add offline status UX

Expose online, offline, syncing, and failed states clearly in the UI.

Done when:
- users can see connectivity and sync state
- failed syncs are actionable
- switching district does not silently reroute queued work

## Phase 7: Migration, hardening, and launch readiness

### B8.1 `P0` ✅ Add platform-wide unique constraints for `client_generated_id`

Protect reconnect sync from duplicate replay across the platform.

Done when:
- top-level offline-created entities have unique `client_generated_id` constraints where relevant
- create routes can safely handle retries
- duplicate replay returns deterministic results

### B8.2 `P1` Backfill or import historical data into the chosen model

Prepare real district data without compromising integrity.

Done when:
- opening balances, funds, members, counterparties, and historical transactions follow the selected migration strategy
- placeholder members are used deliberately for unknown contributors
- imported data is attached to the correct district

### B8.3 `P1` Add automated tests for core accounting invariants

Cover the highest-risk paths before rollout.

Done when:
- tests cover tenant isolation
- tests cover posting, reversal, and transfer idempotency
- tests cover tithe snapshot reporting and offline replay safety

### B8.4 `P1` Add monitoring and operational error surfacing

Make production issues visible and diagnosable.

Done when:
- protected routes emit actionable logs for domain failures
- sync and export failures are traceable
- superuser support workflows can troubleshoot district issues safely

### B8.5 `P2` Migrate UI primitives toward the Radix-based design direction

Bring dialogs, selects, menus, and toasts closer to the v2.3 frontend approach over time.

Done when:
- new workflow-heavy surfaces use accessible, reusable primitives
- the design system is consistent across cashbook, transfers, budgets, and reports
- migration does not block core accounting delivery

## Suggested first sprint

If the goal is to create momentum quickly without rework, start here:

1. B0.1 Decide the migration strategy and source of truth.
2. B0.2 Stop auto-posting on transaction creation.
3. B0.3 Remove destructive delete paths for operational data.
4. B0.4 Lock the role and permission matrix.
5. B1.1 Introduce `user_profiles` and `district_users`.
6. B1.2 Refactor auth context to membership-based district access.
7. B2.5 Build the root `members` model and seeding rules.
8. B3.1 Align transaction schema to include member/counterparty and offline-id fields.

## Deferred or out of scope for this backlog

The following remain outside current release planning unless priorities change:

- full double-entry ledger
- payroll, tax, and depreciation
- automated bank or mobile money integrations
- bank reconciliation
- public member portal or pledge engine
- advanced approval chains beyond the agreed district workflow
