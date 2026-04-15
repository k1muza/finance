export type Currency = 'USD' | 'ZAR' | 'ZWG'
export type PaymentMethod = 'cash' | 'bank' | 'ecocash'

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: '$',
  ZAR: 'R',
  ZWG: 'ZWG',
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bank: 'Bank Transfer',
  ecocash: 'EcoCash',
}

export interface District {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export type AccountType = 'cash' | 'bank' | 'mobile_money' | 'petty_cash'
export type AccountStatus = 'active' | 'archived'

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: 'Cash Box',
  bank: 'Bank Account',
  mobile_money: 'Mobile Money',
  petty_cash: 'Petty Cash',
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
  created_at: string
  updated_at: string
  district?: District | null
}

export interface Fund {
  id: string
  district_id: string
  name: string
  description: string | null
  is_restricted: boolean
  created_at: string
  updated_at: string
  district?: District | null
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

export interface Expense {
  id: string
  district_id: string
  account_id: string | null
  fund_id: string | null
  description: string
  amount: number
  currency: Currency
  payment_method: PaymentMethod
  date: string
  category: string | null
  created_at: string
  district?: District | null
  account?: Account | null
  fund?: Fund | null
}

export interface Income {
  id: string
  district_id: string
  account_id: string | null
  fund_id: string | null
  description: string
  amount: number
  currency: Currency
  payment_method: PaymentMethod
  date: string
  category: string | null
  created_at: string
  district?: District | null
  account?: Account | null
  fund?: Fund | null
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
  kind: TransactionKind
  status: TransactionStatus
  transaction_date: string
  reference_number: string | null
  counterparty: string | null
  narration: string | null
  currency: Currency
  total_amount: number
  source_transaction_id: string | null
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
