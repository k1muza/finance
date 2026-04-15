export interface District {
  id: string
  name: string
  created_at: string
  updated_at: string
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
  fund_id: string | null
  description: string
  amount: number
  date: string
  category: string | null
  created_at: string
  district?: District | null
  fund?: Fund | null
}

export interface Income {
  id: string
  district_id: string
  fund_id: string | null
  description: string
  amount: number
  date: string
  category: string | null
  created_at: string
  district?: District | null
  fund?: Fund | null
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
