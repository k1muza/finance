# District Church Accounting System
## Engineering Specification v2.3

**Status:** Working Draft  
**Owner:** Kelvin

---

## 1. Purpose

This document defines the engineering design for a multi-tenant district church accounting system.

The system must allow a district secretary to register, create a district, and operate a finance workspace for that district. All finance data must belong to a district and be isolated from other districts. Superusers must have access across all districts.

The system is intended to support:

- receipts
- payments
- transfers between district-controlled accounts
- fund-based reporting
- tithe capture at individual level
- reporting at assembly and region level
- budgets by fund
- monthly cashbook spreadsheet exports
- offline-first capture with sync when back online

This version reflects the following product and architecture decisions:

- multi-tenant by district
- stack changed to Supabase + Next.js + Tailwind
- `entities` split into `members` and `counterparties`
- `audit_events` removed from current scope
- budgets added
- offline functionality included
- monthly cashbook spreadsheet export included
- offline mode is **draft-capture only**
- `client_generated_id` is **globally unique**

---

## 2. Product Goals

The system must allow each district to:

- manage its own accounts
- manage its own funds
- manage its own members, counterparties, and hierarchy
- record receipts
- record payments
- record transfers
- manage budgets tied to funds
- compare budget against actuals
- export monthly cashbooks
- work offline for core draft capture workflows
- sync local changes when connectivity returns

The platform must also allow:

- district self-onboarding
- strict tenant isolation
- platform superuser oversight across all districts

---

## 3. Non-Goals for Current Phase

The following are out of scope for now:

- full double-entry accounting
- general ledger and trial balance
- automated bank integrations
- automated mobile money integrations
- automated bank reconciliation
- payroll
- tax handling
- depreciation and fixed assets
- public member portal
- pledge engine
- advanced approval chains
- dedicated audit event subsystem
- offline posting of transactions or transfers
- offline reversal of posted records

The current design should not block these features later.

---

## 4. Architecture Overview

### 4.1 Tech stack

#### Frontend
- Next.js
- TypeScript
- Tailwind CSS
- Radix UI for accessible unstyled component primitives
- TanStack Query for server state, cached reads, and sync-aware data hydration
- Zustand for client-side app state
- client-side local persistence for offline support
- IndexedDB-backed storage for offline cache and queued writes

#### Backend platform
- Supabase Postgres
- Supabase Auth
- Supabase Storage
- Supabase server-side functions or protected backend endpoints for critical workflows

### 4.2 Architectural principles

- district is the tenant boundary
- all district-owned data must carry `district_id`
- tenant isolation must be enforced server-side
- posted transactions are not deleted
- balances are derived from posted transactions
- transfers are modeled explicitly
- currency is bound to account
- member hierarchy is first-class
- budgets are structured by fund and period
- offline capture must preserve integrity on sync

## 4.3 UI component approach

The frontend should use **Radix UI** primitives together with **Tailwind CSS** for styling.

Radix UI should be used for accessible, keyboard-friendly building blocks such as:

- dialogs
- dropdown menus
- select inputs
- tabs
- accordions
- popovers
- tooltips
- toast notifications

Recommended approach:
- use Radix UI primitives
- wrap them in project-specific components
- apply Tailwind styles through a shared design system

This keeps the UI consistent, accessible, and maintainable without locking the project into a rigid component theme.

### 4.4 State ownership model

The frontend shall separate state ownership clearly:

#### TanStack Query owns
- server state fetched from Supabase
- cached list/detail/report data
- revalidation and refetching behavior
- sync-aware hydration of backend-backed records

TanStack Query is the primary owner of remote data state.

#### Zustand owns
- current district selection
- sync banner/status UI state
- modal and dialog state
- report filter draft state
- temporary app-level UI preferences
- other non-server client state that should be shared across components

Zustand is not the source of truth for backend records.

#### IndexedDB/local persistence owns
- offline cache persistence
- queued offline draft operations
- queued attachment uploads
- reconnect replay metadata

This separation avoids mixing server state, local UI state, and offline durability concerns into one tool.

- balance-affecting actions must be validated online by protected backend logic

---

## 5. Multi-Tenant Model

### 5.1 Tenant definition

A **district** is the tenant.

Each district has its own isolated workspace containing:

- accounts
- funds
- members
- counterparties
- transactions
- transfers
- budgets
- budget lines
- exports
- attachments
- district users

### 5.2 Platform roles

There are two broad access levels:

#### District-scoped users
Users who belong to one or more districts and only access those districts.

#### Superusers
Platform-level users who can access all districts.

### 5.3 Core tenancy rule

Every district-owned record must belong to exactly one district.

Every query, mutation, report, export, and sync operation must be scoped to a district unless performed by a superuser.

---

## 6. User and District Onboarding

### 6.1 Registration flow

A district secretary should be able to:

1. sign up
2. create a district
3. automatically become the first district admin or district secretary for that district
4. enter the district workspace
5. configure accounts, funds, members, and counterparties

### 6.2 District creation flow

When a user creates a district, the system must:

- create a `districts` row
- create a `district_users` membership row
- assign the creator an administrative district role
- initialize basic district settings if required

### 6.3 Superuser creation

Superusers are platform-managed users and are not created through normal district self-service onboarding.

---

## 7. Domain Model

The main domain objects are:

- User
- User Profile
- District
- District User
- Currency
- Account
- Fund
- Member
- Transaction
- Transfer
- Budget
- Budget Line
- Attachment

---

## 8. Data Ownership Model

### 8.1 Platform-owned tables

These are global or platform-level:

- users
- user_profiles
- districts
- district_users
- currencies

### 8.2 District-owned tables

These must include `district_id`:

- accounts
- funds
- members
- counterparties
- transactions
- transfers
- budgets
- budget_lines
- attachments

### 8.3 Cross-record integrity rule

Any district-owned record that references another district-owned record must reference a record from the same district.

Examples:

- `transaction.account_id` must point to an account in the same district
- `transaction.fund_id` must point to a fund in the same district
- `transaction.member_id` must point to a member in the same district
- `transaction.counterparty_id` must point to a counterparty in the same district
- `budget_line.fund_id` must point to a fund in the same district
- `member.parent_member_id` must point to a member in the same district

---

## 9. Core Tables

### 9.1 `districts`

**Purpose:** Represents a tenant.

**Fields:**
- `id`
- `name`
- `slug`
- `country`, nullable
- `default_currency_id`, nullable
- `created_by_user_id`
- `is_active`
- `created_at`
- `updated_at`

**Constraints:**
- `slug` unique
- `created_by_user_id` required
- only active districts can be used operationally

---

### 9.2 `district_users`

**Purpose:** Maps users to districts and assigns district-level roles.

**Fields:**
- `id`
- `district_id`
- `user_id`
- `role`
- `is_active`
- `joined_at`
- `created_at`
- `updated_at`

**Suggested roles:**
- `DISTRICT_ADMIN`
- `DISTRICT_SECRETARY`
- `TREASURER`
- `AUDITOR`
- `VIEWER`

**Constraints:**
- unique `(district_id, user_id)`
- one user may belong to multiple districts
- roles are district-specific

---

### 9.3 `user_profiles`

**Purpose:** Stores platform-level user metadata.

**Fields:**
- `user_id`
- `full_name`
- `is_superuser`
- `created_at`
- `updated_at`

**Notes:**
- `is_superuser = true` gives global access

---

### 9.4 `currencies`

**Purpose:** Stores supported currencies.

**Fields:**
- `id`
- `code`
- `name`
- `symbol`
- `is_active`
- `created_at`
- `updated_at`

**Notes:**
- currencies are global, not district-specific

**Examples:**
- USD
- ZWG
- ZAR

---

### 9.5 `accounts`

**Purpose:** Stores district-controlled cash, bank, and mobile money accounts.

**Fields:**
- `id`
- `district_id`
- `name`
- `account_type`
- `currency_id`
- `institution_name`
- `account_identifier`
- `is_active`
- `sort_order`
- `created_at`
- `updated_at`

**Allowed `account_type`:**
- `BANK`
- `MOBILE_MONEY`
- `CASH`
- `DEPOSIT_HOLDING`
- `OTHER`

**Constraints:**
- account belongs to one district
- account belongs to one currency
- unique `(district_id, name)`

---

### 9.6 `funds`

**Purpose:** Stores financial classification buckets for a district.

**Fields:**
- `id`
- `district_id`
- `name`
- `code`
- `fund_nature`
- `requires_individual_member`
- `is_active`
- `description`
- `created_at`
- `updated_at`

**Allowed `fund_nature`:**
- `INCOME`
- `EXPENSE`
- `BOTH`

**Constraints:**
- unique `(district_id, name)`
- inactive funds cannot be used for new records

**Examples:**
- Tithes
- Free Will Offering
- Welfare
- Building Fund
- Conference Fund

---

### 9.7 `members`

**Purpose:** Stores the internal district hierarchy used for tithes, remittances, and reporting.

**Fields:**
- `id`
- `district_id`
- `name`
- `member_type`
- `parent_member_id`
- `code`
- `phone_number`
- `email`
- `is_active`
- `metadata`
- `created_at`
- `updated_at`

**Allowed `member_type`:**
- `DISTRICT`
- `REGION`
- `ASSEMBLY`
- `INDIVIDUAL`
- `DEPARTMENT`

**Hierarchy rules:**
- DISTRICT member must have no parent
- REGION parent, if present, must be DISTRICT member
- ASSEMBLY parent must be REGION member
- INDIVIDUAL parent should be ASSEMBLY member
- DEPARTMENT may belong to DISTRICT, REGION, or ASSEMBLY depending on business choice

**Constraints:**
- parent must belong to same district
- no cyclic hierarchy
- unique `(district_id, member_type, name, parent_member_id)` is recommended

---

### 9.8 `counterparties`

**Purpose:** Stores external suppliers and other non-member payees or payers.

**Fields:**
- `id`
- `district_id`
- `name`
- `counterparty_type`
- `code`
- `phone_number`
- `email`
- `is_active`
- `metadata`
- `created_at`
- `updated_at`

**Allowed `counterparty_type`:**
- `SUPPLIER`
- `OTHER`

**Constraints:**
- counterparty must belong to one district
- unique `(district_id, counterparty_type, name)` is recommended

---

### 9.9 `transactions`

**Purpose:** Stores receipt, payment, adjustment, and transfer effect rows.

**Fields:**
- `id`
- `district_id`
- `client_generated_id`, nullable
- `device_id`, nullable
- `transaction_date`
- `transaction_type`
- `status`
- `reference_no`
- `account_id`
- `fund_id`, nullable for transfer effect rows if desired
- `member_id`, nullable where allowed
- `counterparty_id`, nullable where allowed
- `amount`
- `description`
- `source_transaction_id`, nullable
- `transfer_group_id`, nullable
- `assembly_member_snapshot_id`, nullable
- `region_member_snapshot_id`, nullable
- `captured_by_user_id`
- `posted_by_user_id`, nullable
- `posted_at`, nullable
- `reversed_by_user_id`, nullable
- `reversed_at`, nullable
- `created_at`
- `updated_at`

**Allowed `transaction_type`:**
- `RECEIPT`
- `PAYMENT`
- `TRANSFER_IN`
- `TRANSFER_OUT`
- `ADJUSTMENT_IN`
- `ADJUSTMENT_OUT`
- `REVERSAL`

**Allowed `status`:**
- `DRAFT`
- `POSTED`
- `REVERSED`
- `VOID_DRAFT`

**Constraints:**
- `district_id` required
- amount > 0
- all referenced district-owned rows must belong to same district
- at most one of `member_id` or `counterparty_id` may be set
- posted transactions cannot be edited in balance-affecting ways
- `client_generated_id` must be globally unique when present

**Notes:**
- `client_generated_id` exists for offline deduplication and safe retry during sync
- uniqueness is global rather than per district or per user to avoid collision edge cases during replay and support operations

---

### 9.10 `transfers`

**Purpose:** Represents a user-facing transfer object that generates two transaction effects on posting.

**Fields:**
- `id`
- `district_id`
- `client_generated_id`, nullable
- `device_id`, nullable
- `transfer_date`
- `from_account_id`
- `to_account_id`
- `amount`
- `reference_no`
- `description`
- `status`
- `captured_by_user_id`
- `posted_by_user_id`, nullable
- `posted_at`, nullable
- `reversed_by_user_id`, nullable
- `reversed_at`, nullable
- `created_at`
- `updated_at`

**Allowed `status`:**
- `DRAFT`
- `POSTED`
- `REVERSED`
- `VOID_DRAFT`

**Constraints:**
- source and destination accounts must belong to same district
- `from_account_id != to_account_id`
- currencies must match in current phase
- amount > 0
- `client_generated_id` must be globally unique when present

---

### 9.11 `budgets`

**Purpose:** Represents a budget period or budget container for a district.

**Fields:**
- `id`
- `district_id`
- `client_generated_id`, nullable
- `device_id`, nullable
- `name`
- `start_date`
- `end_date`
- `status`
- `description`
- `created_by_user_id`
- `created_at`
- `updated_at`

**Allowed `status`:**
- `DRAFT`
- `ACTIVE`
- `CLOSED`

**Constraints:**
- `start_date <= end_date`
- district required
- `client_generated_id` must be globally unique when present

---

### 9.12 `budget_lines`

**Purpose:** Represents a budget target for a specific fund and currency, optionally scoped to a member.

**Fields:**
- `id`
- `district_id`
- `budget_id`
- `fund_id`
- `currency_id`
- `budget_kind`
- `amount`
- `scope_member_id`, nullable
- `notes`
- `created_at`
- `updated_at`

**Allowed `budget_kind`:**
- `INCOME`
- `EXPENSE`

**Constraints:**
- `district_id` required
- budget, fund, and scoped member must belong to same district where applicable
- amount > 0
- recommended uniqueness on:
  - `budget_id`
  - `fund_id`
  - `currency_id`
  - `budget_kind`
  - `scope_member_id`

---

### 9.13 `attachments`

**Purpose:** Stores files associated with transactions or budgets.

**Fields:**
- `id`
- `district_id`
- `transaction_id`, nullable
- `budget_id`, nullable
- `storage_path`
- `original_filename`
- `uploaded_by_user_id`
- `created_at`

**Constraints:**
- referenced transaction or budget must belong to same district
- file access must be district-scoped

---

## 10. Member Hierarchy and Reporting Snapshots

### 10.1 Why snapshots are needed

Individuals may move between assemblies or assemblies may change regions over time. Historical reports must remain correct for the structure that existed when a transaction was captured.

### 10.2 Snapshot policy

When a transaction is posted:

- if `member_id` is `INDIVIDUAL`:
  - derive assembly and region from hierarchy
  - store `assembly_member_snapshot_id`
  - store `region_member_snapshot_id`

- if `member_id` is `ASSEMBLY`:
  - set `assembly_member_snapshot_id = member_id`
  - derive and store region

- if `member_id` is `REGION`:
  - set `region_member_snapshot_id = member_id`

- if `counterparty_id` is present, or no member is selected:
  - member hierarchy snapshots may remain null unless a future use case requires otherwise

### 10.3 Integrity rule

Snapshot IDs must point to members in the same district as the transaction.

---

## 11. Transaction Semantics

### 11.1 Receipt

A receipt increases the balance of the selected account.

Typical fields:
- district
- date
- account
- fund
- member or counterparty
- amount
- reference
- description

Examples:
- individual tithe
- region remittance
- offering deposit

### 11.2 Payment

A payment decreases the balance of the selected account.

Typical fields:
- district
- date
- account
- fund
- member or counterparty used as payee
- amount
- reference
- description

Examples:
- welfare payment
- supplier payment
- transport reimbursement

### 11.3 Transfer

A transfer moves money between two district-owned accounts.

On posting:
- create one `TRANSFER_OUT` transaction row
- create one `TRANSFER_IN` transaction row
- both rows belong to same district
- both share a `transfer_group_id`

Transfers must not count as income or expense in fund reporting.

### 11.4 Adjustments

Adjustments are controlled corrections or opening/migration entries.

Use:
- `ADJUSTMENT_IN`
- `ADJUSTMENT_OUT`

Adjustments should be restricted to higher-permission users.

### 11.5 Reversal

Posted transactions must not be deleted.

A reversal:
- creates an opposite effect row or equivalent controlled reversal entry
- links back to original via `source_transaction_id`
- preserves history
- must remain within same district

For transfers, reversal must reverse the transfer as a unit.

---

## 12. Balance Rules

Balances must be derived from posted effective transactions.

For an account in a district:

- `RECEIPT` => `+amount`
- `PAYMENT` => `-amount`
- `TRANSFER_IN` => `+amount`
- `TRANSFER_OUT` => `-amount`
- `ADJUSTMENT_IN` => `+amount`
- `ADJUSTMENT_OUT` => `-amount`
- `REVERSAL` => opposite of original effect

### 12.1 Running balance

For monthly cashbook view:
- order by `transaction_date`, then `posted_at`, then `id`
- compute cumulative signed balance

### 12.2 Current balance

Sum all posted effective transaction effects for the account in that district.

---

## 13. Business Rules

### 13.1 General rules
- every district-owned record must have `district_id`
- cross-district references are forbidden
- only active district records may be used for new operations
- amount must be greater than zero
- posted transactions are immutable except by reversal
- draft transactions may be edited
- draft transactions may be voided

### 13.2 Tithes rules
- if fund = Tithes, `member_id` must be `INDIVIDUAL`
- individual must belong to an assembly
- assembly must belong to a region
- snapshots must be populated on posting
- tithe reports by region must aggregate from individual transactions via region snapshot

### 13.3 Payment rules
- payments should normally have either a payee member or a registered counterparty
- payment must belong to one fund
- payment decreases one account only in this phase

### 13.4 Receipt rules
- receipts should normally have a member
- receipt must belong to one fund
- miscellaneous or anonymous receipts may use a placeholder member or fallback counterparty name if allowed by business process

### 13.5 Transfer rules
- source and destination accounts must differ
- both accounts must belong to same district
- both accounts must use same currency in this phase
- transfer rows must not affect fund totals

### 13.6 Budget rules
- every budget belongs to one district
- budget lines target specific funds
- budget lines are currency-specific
- budget lines may optionally be scoped to a member
- actuals must be computed only from transactions in same district and date range

---

## 14. Offline-First Design

### 14.1 Requirement

Core capture workflows must continue while offline, then sync to backend when connectivity returns.

### 14.2 Offline-supported operations

Must support offline:
- cached master data reads
- create draft receipt
- create draft payment
- create draft transfer
- create budget draft
- create budget line draft
- queue attachment uploads
- view recently cached reports

### 14.3 Explicit offline limitation

Offline mode is **draft-capture only**.

The system must **not** allow the following while offline:
- posting a transaction
- reversing a posted transaction
- posting a transfer
- reversing a transfer
- activating or closing a budget

These operations are balance-affecting and require online server validation to prevent hard conflicts, such as two users attempting to reverse the same transaction offline.

### 14.4 Rationale for draft-only offline mode

Draft-only offline mode is the preferred design unless a strong operational requirement emerges for offline posting.

This approach reduces the risk of:
- duplicate posting
- conflicting reversals
- stale hierarchy validation
- budget state conflicts
- harder reconciliation after reconnect

### 14.5 Offline state and sync tooling

The recommended ownership for offline support is:

- **TanStack Query** for server-state caching and hydration
- **Zustand** for app-level sync UI state and district context
- **IndexedDB** for durable offline cache and queued writes
- custom sync logic for reconnect replay and conflict handling

### 14.6 Local queue

Each queued item must include:
- local operation id
- `district_id`
- `client_generated_id` where relevant
- operation type
- payload
- retry count
- status:
  - `PENDING`
  - `SYNCING`
  - `SYNCED`
  - `FAILED`
  - `CONFLICT`
- `created_at`

### 14.7 Sync rules

When back online:
1. process queue in order
2. validate district context
3. sync master data changes first where needed
4. sync dependent records next
5. upload attachments
6. mark item as synced or failed

### 14.8 Offline conflict policy

Server remains source of truth.

If sync fails because:
- member is inactive
- fund was removed
- transaction already posted/reversed
- hierarchy changed and rules no longer pass

then:
- item must be marked `FAILED` or `CONFLICT`
- user must resolve manually
- no silent auto-merge for balance-affecting operations

### 14.9 District awareness offline

Queued operations must stay bound to their original district. A user switching to another district must not cause queued records to sync into the wrong tenant.

---

## 15. State Machines

### 15.1 Transaction lifecycle

States:
- `DRAFT`
- `POSTED`
- `REVERSED`
- `VOID_DRAFT`

Transitions:
- `DRAFT -> POSTED`
- `DRAFT -> VOID_DRAFT`
- `POSTED -> REVERSED`

### 15.2 Transfer lifecycle

States:
- `DRAFT`
- `POSTED`
- `REVERSED`
- `VOID_DRAFT`

On `POSTED`:
- generate transfer effect rows

On `REVERSED`:
- reverse transfer as one logical unit

### 15.3 Budget lifecycle

States:
- `DRAFT`
- `ACTIVE`
- `CLOSED`

Transitions:
- `DRAFT -> ACTIVE`
- `ACTIVE -> CLOSED`

---

## 16. Permissions Model

### 16.1 Platform-level roles

#### Superuser
Can:
- view all districts
- manage all districts
- view and manage all district data
- troubleshoot across tenants

### 16.2 District-level roles

#### `DISTRICT_ADMIN`
Can manage users, setup, transactions, transfers, budgets, and reports for that district.

#### `DISTRICT_SECRETARY`
Can manage most daily finance operations, subject to business choices.

#### `TREASURER`
Can post, reverse, approve, and manage finance records.

#### `AUDITOR`
Read-only access to district records and reports.

#### `VIEWER`
Limited read-only access.

### 16.3 Permission examples
- `district.manage`
- `district_users.manage`
- `accounts.manage`
- `funds.manage`
- `members.manage`
- `counterparties.manage`
- `transactions.create`
- `transactions.post`
- `transactions.reverse`
- `transfers.create`
- `transfers.post`
- `transfers.reverse`
- `budgets.manage`
- `reports.view`
- `exports.generate`

Permissions are district-scoped unless user is superuser.

---

## 17. Tenant Isolation Rules

### 17.1 Core rule
A district user may only access data for districts where they have active membership.

### 17.2 Superuser rule
A superuser may access all districts.

### 17.3 Enforcement rule
Tenant isolation must not depend on frontend filtering. It must be enforced by backend policies and protected server-side logic.

### 17.4 Hierarchy rule
Member hierarchy cannot cross district boundaries.

### 17.5 Export rule
Exports must only include rows from the selected district.

---

## 18. Backend Access Pattern

### 18.1 Reads
Standard district-scoped reads may be done directly where safe.

### 18.2 Sensitive writes
Use protected backend logic for:
- posting transactions
- reversing transactions
- posting transfers
- reversing transfers
- activating/closing budgets
- export generation

These operations must validate:
- district membership
- record ownership
- business rules
- state transitions

---

## 19. Reporting Requirements

All reports must be district-scoped.

### 19.1 Cashbook by account
Inputs:
- district
- account
- month or date range

Columns:
- date
- reference no
- transaction type
- description
- member / payee
- fund
- amount in
- amount out
- running balance
- status
- posted at

### 19.2 Tithes by individual
Group tithe receipts by individual member.

### 19.3 Tithes by assembly
Group tithe receipts by `assembly_member_snapshot_id`.

### 19.4 Tithes by region
Group tithe receipts by `region_member_snapshot_id`.

### 19.5 Fund summary
Show receipt and payment totals by fund, excluding transfers.

### 19.6 Account balances
Show current balance by account.

### 19.7 Budget vs actual
For each budget line:
- fund
- currency
- budget kind
- budget amount
- actual amount
- variance

Actuals must be derived from posted transactions in same district and period.

---

## 20. Monthly Cashbook Spreadsheet Export

### 20.1 Requirement
The system must export a monthly cashbook spreadsheet for a selected district account.

### 20.2 Inputs
- district
- account
- month
- year
- optional include opening balance
- optional include reversed visibility flag

### 20.3 Output columns
- Date
- Reference No
- Transaction Type
- Description
- Member / Payee
- Fund
- Amount In
- Amount Out
- Running Balance
- Status
- Posted At

### 20.4 Filename
Suggested pattern:
- `{district-slug}-cashbook-{account-name}-{yyyy-mm}.xlsx`

### 20.5 Export rules
- include only that district’s transactions
- use posted effective rows
- compute opening balance from transactions before month start
- compute running balance through month
- generate server-side

---

## 21. API / Backend Operations

Logical operations should be district-scoped.

### 21.1 Districts
- create district
- list accessible districts
- get district detail
- manage district settings

### 21.2 District users
- invite/add district user
- change district role
- deactivate district membership
- list district members

### 21.3 Accounts
- list district accounts
- create account
- update account
- deactivate account

### 21.4 Funds
- list district funds
- create fund
- update fund
- deactivate fund

### 21.5 Members and counterparties
- list district members
- create member
- update member
- reparent member
- list member hierarchy
- list district counterparties
- create counterparty
- update counterparty
- deactivate counterparty

### 21.6 Transactions
- create draft transaction
- update draft transaction
- post transaction
- reverse transaction
- void draft
- list district transactions
- get district transaction detail

### 21.7 Transfers
- create draft transfer
- update draft transfer
- post transfer
- reverse transfer
- list district transfers
- get transfer detail

### 21.8 Budgets
- create budget
- update budget
- activate budget
- close budget
- create budget line
- update budget line
- remove draft budget line
- list district budgets
- budget vs actual report

### 21.9 Exports
- generate monthly cashbook export
- optionally list generated exports later

---

## 22. Validation Rules

### 22.1 District validation
For every district-scoped write:
- user must belong to district or be superuser
- all referenced district-owned rows must belong to that district

### 22.2 Member validation
- valid parent-child type pairing
- no cyclic hierarchy
- parent must belong to same district

### 22.3 Transaction validation
- account active and same district
- fund active and same district
- member same district where supplied
- counterparty same district where supplied
- amount > 0
- valid transaction type
- if fund requires individual member, member must be `INDIVIDUAL`
- snapshots derivable where required

### 22.4 Transfer validation
- both accounts active
- both accounts same district
- different accounts
- same currency
- amount > 0

### 22.5 Budget validation
- start date <= end date
- fund active and same district
- scoped member same district where supplied
- amount > 0

---

## 23. Row-Level Security and Access Control

### 23.1 General principle
All district-owned tables must enforce district access.

### 23.2 District user access
Allow access only when:
- user has active membership in row’s district
- and permission allows that operation

### 23.3 Superuser access
Allow full access when platform profile says `is_superuser = true`.

### 23.4 Sensitive workflow rule
Even with RLS, posting/reversal/export should still use protected server-side logic to ensure business rules are applied consistently.

---

## 24. Concurrency and Integrity

### 24.1 Posting idempotency
Posting should be safe against retries and double-submission.

### 24.2 Transfer atomicity
Posting a transfer must either:
- create both effect rows and mark transfer posted
- or fail entirely

### 24.3 Reversal idempotency
A record must not be reversed twice.

### 24.4 Sync idempotency
`client_generated_id` should help prevent duplicates during reconnect sync.

### 24.5 `client_generated_id` uniqueness scope
`client_generated_id` must be treated as **globally unique** across the platform.

This applies to any offline-created top-level object that may be retried or replayed during sync, including:
- transactions
- transfers
- budgets

This avoids ambiguity about whether the same client-generated identifier could validly exist in two districts or under two users.

Recommended implementation:
- generate UUIDs on device/client
- store a unique constraint on `client_generated_id` for each applicable table
- use it for idempotent create semantics during sync

---

## 25. Suggested Indexes

### District-owned tables
Recommended indexes on:
- `district_id`
- common lookup combinations by status/date/type

### `transactions`
- `(district_id, account_id, transaction_date, id)`
- `(district_id, fund_id, transaction_date)`
- `(district_id, member_id, transaction_date)`
- `(district_id, counterparty_id, transaction_date)`
- `(district_id, region_member_snapshot_id, transaction_date)`
- `(district_id, assembly_member_snapshot_id, transaction_date)`
- `(district_id, status, transaction_type, transaction_date)`
- `(transfer_group_id)`
- `(source_transaction_id)`
- `(client_generated_id)` unique where not null

### `members`
- `(district_id, parent_member_id)`
- `(district_id, member_type, is_active)`

### `counterparties`
- `(district_id, counterparty_type, is_active)`

### `accounts`
- `(district_id, currency_id, is_active)`

### `funds`
- `(district_id, is_active)`

### `budgets`
- `(district_id, status, start_date, end_date)`

---

## 26. Error Handling

Common errors include:

- invalid district access
- cross-district reference attempt
- invalid member hierarchy
- tithe without individual member
- inactive fund/account/member/counterparty
- duplicate post/reversal attempt
- sync conflict due to stale offline data

Suggested response codes:
- `400` for invalid input
- `403` for forbidden access
- `404` for missing resource
- `409` for state conflict
- `422` for rule validation failure

Example domain errors:
- `CROSS_DISTRICT_REFERENCE`
- `INVALID_TITHE_MEMBER`
- `MEMBER_HIERARCHY_INVALID`
- `TRANSFER_CURRENCY_MISMATCH`
- `DISTRICT_ACCESS_DENIED`
- `SYNC_CONFLICT`

---

## 27. Migration and Legacy Data

If importing from manual books or spreadsheets:

1. create district
2. create accounts
3. create funds
4. create member hierarchy and counterparties
5. import opening balances
6. import historical transactions where possible
7. map unknown historical contributors to placeholder members or fallback names if needed

All imported records must be attached to the correct district.

---

## 28. Testing Strategy

### 28.1 Unit tests
Cover:
- tenant scoping rules
- member hierarchy validation
- transaction validation
- transfer posting
- reversal logic
- balance computation
- budget actual aggregation

### 28.2 Integration tests
Cover:
- user creates district and becomes district admin
- district user cannot access another district’s data
- superuser can access all districts
- tithe receipt populates snapshots
- budget vs actual uses same district only
- monthly export excludes other districts
- offline replay does not create duplicate transaction
- offline posting attempt is rejected while offline or deferred until online

### 28.3 Critical test cases
- create district -> create account/fund/member -> create tithe -> report by region
- attempt cross-district transaction reference -> reject
- switch district with pending offline queue -> queued items still sync to original district
- generate export for District A -> no District B rows present
- create offline draft with `client_generated_id` -> reconnect -> sync once even if retry happens multiple times

---

## 29. Security Considerations

- enforce authentication for all protected operations
- enforce district isolation server-side
- never trust district filtering from client alone
- compute snapshots server-side
- restrict attachments to authorized district users
- protect superuser operations carefully
- prevent direct unsafe balance-affecting row edits from clients

---

## 30. UI/UX Notes

### 30.1 District selection
After login, user should select a district if they belong to more than one.

### 30.2 Workspace context
Current district should be clearly visible in UI at all times.

### 30.3 Offline indicators
Show:
- online
- offline
- syncing
- sync failed

### 30.4 Forms
Transaction forms should:
- auto-filter records to current district
- show member hierarchy preview where relevant
- show derived assembly/region before posting for tithe entries
- clearly distinguish `Save Draft` from `Post`

### 30.5 Offline behavior in UI
When offline:
- show that records will be saved as drafts only
- disable or hide post/reverse actions
- show queued draft status

### 30.6 Export UX
User should be able to:
- choose month
- choose account
- generate workbook
- download workbook

---

## 31. Open Design Decisions

These still need explicit decision:

1. Can one user belong to multiple districts from day one, or only later?
2. Should district creation auto-seed default funds?
3. Should every district automatically get a DISTRICT member record in its hierarchy?
4. Are anonymous receipts allowed?
5. Should budgets support region- or assembly-specific member scoping from first release?
6. Should superuser be able to impersonate district context for support?

**Resolved in this version:**
- offline mode allows draft capture only, not posting
- `client_generated_id` uniqueness scope is global

---

## 32. Recommended Phase Plan

### Phase 1A
- auth
- districts
- district memberships
- district context selection
- accounts
- funds
- members
- counterparties

### Phase 1B
- transactions
- tithe rules
- balances
- cashbook view
- fund and tithe reports

### Phase 1C
- transfers
- reversals
- budgets
- budget vs actual

### Phase 1D
- monthly spreadsheet export
- offline draft queue
- reconnect sync
- conflict handling

---

## 33. Summary

This system should be built as a **multi-tenant district finance platform** where **district is the primary ownership boundary**.

The key engineering decisions are:

- district is the tenant
- all district-owned tables carry `district_id`
- member hierarchy is district-scoped
- transactions, transfers, budgets, and exports are district-scoped
- users only access districts they belong to unless they are superusers
- tithes are captured by individual and reported upward through snapshots
- balances are derived from posted transactions
- offline writes are queued with district awareness
- offline mode is draft-only for safety
- `client_generated_id` is globally unique for sync idempotency
- monthly cashbook exports are generated per district account

This gives you a sound base for both operational usability and safe platform growth.
