import { Budget, CashbookTransaction, Currency, Expense, Income } from '@/types'

// Kinds that represent money flowing IN to the district
const CASHBOOK_IN_KINDS = new Set(['receipt', 'opening_balance', 'adjustment'])

export function buildCashbookFundBalances(transactions: CashbookTransaction[]) {
  const rows = new Map<string, FundBalanceRow>()

  const ensureRow = (
    district_id: string,
    fund_id: string | null,
    fund_name: string,
    currency: Currency
  ) => {
    const key = `${district_id}:${fund_id ?? 'unassigned'}:${currency}`
    if (!rows.has(key)) {
      rows.set(key, {
        district_id,
        district_name: '',
        fund_id,
        fund_name,
        currency,
        income_total: 0,
        expense_total: 0,
        net_balance: 0,
      })
    }
    return rows.get(key)!
  }

  for (const txn of transactions) {
    const row = ensureRow(
      txn.district_id,
      txn.fund_id,
      (txn.fund as { name?: string } | null)?.name ?? 'Unassigned',
      txn.currency
    )
    if (CASHBOOK_IN_KINDS.has(txn.kind)) {
      row.income_total += Number(txn.total_amount)
    } else {
      row.expense_total += Number(txn.total_amount)
    }
    row.net_balance = row.income_total - row.expense_total
  }

  return [...rows.values()].sort((a, b) =>
    a.currency.localeCompare(b.currency)
    || b.net_balance - a.net_balance
    || a.fund_name.localeCompare(b.fund_name)
  )
}

export function buildCashbookTotalsByCurrency(transactions: CashbookTransaction[]) {
  const inByCurrency: Partial<Record<Currency, number>> = {}
  const outByCurrency: Partial<Record<Currency, number>> = {}

  for (const txn of transactions) {
    if (CASHBOOK_IN_KINDS.has(txn.kind)) {
      inByCurrency[txn.currency] = (inByCurrency[txn.currency] ?? 0) + Number(txn.total_amount)
    } else {
      outByCurrency[txn.currency] = (outByCurrency[txn.currency] ?? 0) + Number(txn.total_amount)
    }
  }

  return { inByCurrency, outByCurrency }
}

export interface FundBalanceRow {
  district_id: string
  district_name: string
  fund_id: string | null
  fund_name: string
  currency: Currency
  income_total: number
  expense_total: number
  net_balance: number
}

export interface BudgetComparisonRow {
  id: string
  district_id: string
  district_name: string
  fund_id: string | null
  fund_name: string
  type: Budget['type']
  category: string
  amount: number
  currency: Currency
  period_start: string
  period_end: string
  notes: string | null
  actual: number
  variance: number
  status: 'met_target' | 'below_target' | 'within_budget' | 'over_budget'
}

function relationName(value: { name?: string } | { name?: string }[] | null | undefined, fallback: string) {
  if (Array.isArray(value)) return value[0]?.name ?? fallback
  return value?.name ?? fallback
}

function inPeriod(date: string, periodStart: string, periodEnd: string) {
  return date >= periodStart && date <= periodEnd
}

export function buildFundBalances(income: Income[], expenses: Expense[]) {
  const rows = new Map<string, FundBalanceRow>()

  const ensureRow = (
    district_id: string,
    district_name: string,
    fund_id: string | null,
    fund_name: string,
    currency: Currency
  ) => {
    const key = `${district_id}:${fund_id ?? 'unassigned'}:${currency}`
    const current = rows.get(key)
    if (current) return current

    const created: FundBalanceRow = {
      district_id,
      district_name,
      fund_id,
      fund_name,
      currency,
      income_total: 0,
      expense_total: 0,
      net_balance: 0,
    }
    rows.set(key, created)
    return created
  }

  for (const entry of income) {
    const row = ensureRow(
      entry.district_id,
      relationName(entry.district as { name?: string } | { name?: string }[] | null, 'District'),
      entry.fund_id,
      relationName(entry.fund as { name?: string } | { name?: string }[] | null, 'Unassigned'),
      entry.currency
    )
    row.income_total += entry.amount
    row.net_balance = row.income_total - row.expense_total
  }

  for (const entry of expenses) {
    const row = ensureRow(
      entry.district_id,
      relationName(entry.district as { name?: string } | { name?: string }[] | null, 'District'),
      entry.fund_id,
      relationName(entry.fund as { name?: string } | { name?: string }[] | null, 'Unassigned'),
      entry.currency
    )
    row.expense_total += entry.amount
    row.net_balance = row.income_total - row.expense_total
  }

  return [...rows.values()].sort((a, b) =>
    a.currency.localeCompare(b.currency)
    || b.net_balance - a.net_balance
    || a.district_name.localeCompare(b.district_name)
    || a.fund_name.localeCompare(b.fund_name)
  )
}

export function buildBudgetComparisons(budgets: Budget[], income: Income[], expenses: Expense[]) {
  return budgets
    .map<BudgetComparisonRow>((budget) => {
      const rows = budget.type === 'income' ? income : expenses
      const actual = rows
        .filter((entry) =>
          entry.district_id === budget.district_id
          && entry.currency === budget.currency
          && inPeriod(entry.date, budget.period_start, budget.period_end)
          && entry.category === budget.category
          && (budget.fund_id ? entry.fund_id === budget.fund_id : true)
        )
        .reduce((sum, entry) => sum + entry.amount, 0)

      const district_name = relationName(budget.district as { name?: string } | { name?: string }[] | null, 'District')
      const fund_name = relationName(budget.fund as { name?: string } | { name?: string }[] | null, 'All funds')
      const variance = budget.type === 'income'
        ? actual - budget.amount
        : budget.amount - actual
      const status = budget.type === 'income'
        ? (actual >= budget.amount ? 'met_target' : 'below_target')
        : (actual <= budget.amount ? 'within_budget' : 'over_budget')

      return {
        id: budget.id,
        district_id: budget.district_id,
        district_name,
        fund_id: budget.fund_id,
        fund_name,
        type: budget.type,
        category: budget.category,
        amount: budget.amount,
        currency: budget.currency,
        period_start: budget.period_start,
        period_end: budget.period_end,
        notes: budget.notes,
        actual,
        variance,
        status,
      }
    })
    .sort((a, b) =>
      b.period_start.localeCompare(a.period_start)
      || a.district_name.localeCompare(b.district_name)
      || a.type.localeCompare(b.type)
      || a.category.localeCompare(b.category)
    )
}
