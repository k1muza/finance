# Finance Data Model

## Entity Relationships

```
districts
  └── accounts          (where money sits)
  └── funds             (purpose of money)
  └── budgets           (planned amounts by fund/category)
  └── income            (legacy receipts — transitional)
  └── expenses          (legacy payments — transitional)
  └── cashbook_transactions
        └── cashbook_transaction_lines
        └── cashbook_audit_log
  └── account_opening_balances
  └── district_transaction_sequences
```

---

## Tables

### districts
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text | unique |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### accounts
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| district_id | uuid FK → districts | |
| name | text | unique per district (case-insensitive) |
| code | text nullable | unique per district when set |
| type | account_type | cash, bank, mobile_money, petty_cash |
| currency | currency_code | USD, ZAR, ZWG |
| status | text | active, archived |
| description | text nullable | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### account_opening_balances
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| account_id | uuid FK → accounts | |
| district_id | uuid FK → districts | |
| effective_date | date | unique per account |
| amount | numeric(12,2) | ≥ 0 |
| currency | currency_code | must match account.currency |
| notes | text nullable | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### funds
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| district_id | uuid FK → districts | |
| name | text | |
| description | text nullable | |
| is_restricted | boolean | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### cashbook_transactions
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| district_id | uuid FK → districts | |
| account_id | uuid FK → accounts | |
| fund_id | uuid FK → funds nullable | |
| kind | transaction_kind | receipt, payment, transfer, adjustment, opening_balance, reversal |
| status | transaction_status | draft → submitted → approved → posted; also reversed, voided |
| transaction_date | date | |
| reference_number | text nullable | assigned by next_transaction_number() on post |
| counterparty | text nullable | payer or payee name |
| narration | text nullable | free-text description |
| currency | currency_code | must match account.currency |
| total_amount | numeric(12,2) | > 0 |
| source_transaction_id | uuid FK → cashbook_transactions nullable | set on reversal |
| created_by | uuid FK → auth.users | |
| submitted_by | uuid FK → auth.users nullable | |
| approved_by | uuid FK → auth.users nullable | |
| posted_by | uuid FK → auth.users nullable | |
| reversed_by | uuid FK → auth.users nullable | |
| submitted_at | timestamptz nullable | |
| approved_at | timestamptz nullable | |
| posted_at | timestamptz nullable | |
| reversed_at | timestamptz nullable | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**Immutability:** the trigger `trg_cashbook_immutability` rejects UPDATE or DELETE of rows with status `posted`, `reversed`, or `voided`.

### cashbook_transaction_lines
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| transaction_id | uuid FK → cashbook_transactions CASCADE | |
| account_id | uuid FK → accounts | |
| fund_id | uuid FK → funds nullable | |
| category | text nullable | |
| amount | numeric(12,2) | > 0 |
| direction | text | debit or credit |
| narration | text nullable | |
| created_at | timestamptz | |

### cashbook_audit_log
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| transaction_id | uuid FK → cashbook_transactions CASCADE | |
| actor_id | uuid FK → auth.users nullable | |
| action | text | created, submitted, approved, posted, reversed, voided, status_changed |
| old_status | transaction_status nullable | |
| new_status | transaction_status nullable | |
| details | jsonb nullable | |
| created_at | timestamptz | |

**Client access:** read-only for district users. The audit log is written by DB triggers only.

### district_transaction_sequences
| Column | Type | Notes |
|---|---|---|
| district_id | uuid FK → districts | PK (composite) |
| year | smallint | PK (composite) |
| last_number | integer | incremented atomically by next_transaction_number() |

**Client access:** none. Used only by the `next_transaction_number()` function on post.

---

## Enums

### currency_code
`USD` | `ZAR` | `ZWG`

### payment_method (legacy income/expenses)
`cash` | `bank` | `ecocash`

### transaction_kind
`receipt` | `payment` | `transfer` | `adjustment` | `opening_balance` | `reversal`

### transaction_status
`draft` → `submitted` → `approved` → `posted`
`posted` → `reversed`
`draft` | `submitted` → `voided`

---

## Transaction Lifecycle

```
draft
  ├── submit  → submitted
  │     ├── approve → approved
  │     │     └── post → posted
  │     │               └── reverse → reversed
  │     └── void → voided
  └── void → voided
```

Account balance for a given date range:
```
balance = opening_balance.amount
        + SUM(posted lines where direction = 'credit')
        - SUM(posted lines where direction = 'debit')
```

---

## Legacy Tables (transitional)

`income` and `expenses` remain the primary write path during Phases 1–6. They are linked to `accounts` via `account_id` FK (added in migration `20260415020000`). In Phase 7 they will be backfilled into `cashbook_transactions` and made read-only.
