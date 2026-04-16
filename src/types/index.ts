export type Currency = string  // resolved at runtime from the currencies table
export type PaymentMethod = 'cash' | 'bank' | 'ecocash'

/** Known symbols for common currencies; others fall back to the code itself. */
export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£',
  ZAR: 'R', ZWG: 'ZWG', ZMW: 'ZK', MWK: 'MK',
  GHS: '₵', NGN: '₦', KES: 'KSh', UGX: 'USh',
  TZS: 'TSh', RWF: 'FRw', ETB: 'Br',
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bank: 'Bank Transfer',
  ecocash: 'EcoCash',
}

export interface District {
  id: string
  name: string
  slug?: string | null
  country?: string | null
  default_currency?: Currency | null
  is_active?: boolean
  created_by?: string | null
  created_at: string
  updated_at: string
}

export interface CurrencyRow {
  code: string
  name: string
  symbol: string | null
  is_active: boolean
}

export type AccountType = 'cash' | 'bank' | 'mobile_money' | 'petty_cash' | 'savings'
export type AccountStatus = 'active' | 'archived'

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: 'Cash Box',
  bank: 'Bank Account',
  mobile_money: 'Mobile Money',
  petty_cash: 'Petty Cash',
  savings: 'Savings Account',
}

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  active: 'Active',
  archived: 'Archived',
}

export interface Account {
  id: string
  district_id: string
  name: string
  code: string | null
  type: AccountType
  currency: Currency
  status: AccountStatus
  description: string | null
  sort_order: number
  institution_name: string | null
  institution_account_number: string | null
  created_at: string
  updated_at: string
  district?: District | null
}

export type FundNature = 'income_only' | 'expense_only' | 'mixed'

export const FUND_NATURE_LABELS: Record<FundNature, string> = {
  income_only: 'Income only',
  expense_only: 'Expense only',
  mixed: 'Mixed',
}

export interface Fund {
  id: string
  district_id: string
  name: string
  code: string | null
  description: string | null
  is_restricted: boolean
  nature: FundNature
  is_active: boolean
  requires_individual_source: boolean
  created_at: string
  updated_at: string
  district?: District | null
}

export type SourceType = 'district' | 'region' | 'assembly' | 'individual' | 'supplier' | 'department' | 'other'

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  district: 'District',
  region: 'Region',
  assembly: 'Assembly',
  individual: 'Individual',
  supplier: 'Supplier',
  department: 'Department',
  other: 'Other',
}

export type IndividualTitle = 'elder' | 'deacon' | 'saint'

export const INDIVIDUAL_TITLE_LABELS: Record<IndividualTitle, string> = {
  elder:  'Elder',
  deacon: 'Deacon',
  saint:  'Saint',
}

export interface Source {
  id: string
  district_id: string
  parent_id: string | null
  type: SourceType
  name: string
  code: string | null
  title: IndividualTitle
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  parent?: Source | null
  children?: Source[]
}

export type BudgetType = 'income' | 'expense'

export interface Budget {
  id: string
  district_id: string
  fund_id: string | null
  type: BudgetType
  category: string
  amount: number
  currency: Currency
  period_start: string
  period_end: string
  notes: string | null
  created_at: string
  updated_at: string
  district?: District | null
  fund?: Fund | null
}

export interface FinanceCategoryBreakdown {
  category: string
  amount: number
  count: number
}

export interface DistrictFinanceBreakdown {
  district_id: string
  district_name: string
  income_total: number
  expense_total: number
  net_balance: number
  income_count: number
  expense_count: number
}

export interface AccountOpeningBalance {
  id: string
  account_id: string
  district_id: string
  effective_date: string
  amount: number
  currency: Currency
  notes: string | null
  created_at: string
  updated_at: string
  account?: Account | null
}

// --- Cashbook ---

export type TransactionKind =
  | 'receipt'
  | 'payment'
  | 'transfer'
  | 'adjustment'
  | 'opening_balance'
  | 'reversal'

export type TransactionStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'posted'
  | 'reversed'
  | 'voided'

export type LineDirection = 'debit' | 'credit'

export const TRANSACTION_KIND_LABELS: Record<TransactionKind, string> = {
  receipt: 'Receipt',
  payment: 'Payment',
  transfer: 'Transfer',
  adjustment: 'Adjustment',
  opening_balance: 'Opening Balance',
  reversal: 'Reversal',
}

export const TRANSACTION_STATUS_LABELS: Record<TransactionStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  posted: 'Posted',
  reversed: 'Reversed',
  voided: 'Voided',
}

export interface CashbookTransaction {
  id: string
  district_id: string
  account_id: string
  fund_id: string | null
  source_id: string | null
  assembly_snapshot_id: string | null
  region_snapshot_id: string | null
  kind: TransactionKind
  status: TransactionStatus
  transaction_date: string
  reference_number: string | null
  counterparty: string | null
  narration: string | null
  currency: Currency
  total_amount: number
  source_transaction_id: string | null
  source_name_snapshot: string | null
  source_type_snapshot: string | null
  source_parent_name_snapshot: string | null
  client_generated_id: string | null
  device_id: string | null
  created_by: string
  submitted_by: string | null
  approved_by: string | null
  posted_by: string | null
  reversed_by: string | null
  submitted_at: string | null
  approved_at: string | null
  posted_at: string | null
  reversed_at: string | null
  created_at: string
  updated_at: string
  account?: Account | null
  fund?: Fund | null
  source?: Source | null
  assembly_snapshot?: Source | null
  region_snapshot?: Source | null
  lines?: CashbookTransactionLine[]
}

export interface CashbookTransactionLine {
  id: string
  transaction_id: string
  account_id: string
  fund_id: string | null
  category: string | null
  amount: number
  direction: LineDirection
  narration: string | null
  created_at: string
  account?: Account | null
  fund?: Fund | null
}

export interface CashbookAuditLog {
  id: string
  transaction_id: string
  actor_id: string | null
  action: string
  old_status: TransactionStatus | null
  new_status: TransactionStatus | null
  details: Record<string, unknown> | null
  created_at: string
}

export interface OverviewStats {
  totalIncome: number
  totalExpenses: number
  netBalance: number
  incomeCount: number
  expenseCount: number
  topIncomeCategories: FinanceCategoryBreakdown[]
  topExpenseCategories: FinanceCategoryBreakdown[]
  districtBreakdown: DistrictFinanceBreakdown[]
}
