export interface District {
  id: string
  name: string
  created_at: string
  updated_at: string
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
  description: string
  amount: number
  date: string
  category: string | null
  created_at: string
  district?: District | null
}

export interface Income {
  id: string
  district_id: string
  description: string
  amount: number
  date: string
  category: string | null
  created_at: string
  district?: District | null
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
