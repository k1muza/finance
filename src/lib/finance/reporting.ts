import type {
  Budget,
  BudgetLine,
  BudgetStatus,
  CashbookTransaction,
  Currency,
  MemberType,
} from '@/types'
import {
  isIncomingTransactionEffect,
  isOutgoingTransactionEffect,
  shouldIncludeInFundReporting,
} from '@/lib/finance/transactions'

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
    if (!shouldIncludeInFundReporting(txn)) continue

    const row = ensureRow(
      txn.district_id,
      txn.fund_id,
      (txn.fund as { name?: string } | null)?.name ?? 'Unassigned',
      txn.currency
    )
    if (isIncomingTransactionEffect(txn)) {
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
    if (!shouldIncludeInFundReporting(txn)) continue

    if (isIncomingTransactionEffect(txn)) {
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

export interface BudgetComparisonLineRow {
  budget_id: string
  budget_name: string
  budget_status: BudgetStatus
  budget_line_id: string
  start_date: string
  end_date: string
  fund_id: string
  fund_name: string
  line_description: string
  currency: Currency
  scope_member_id: string | null
  scope_member_name: string | null
  scope_member_type: MemberType | null
  budget_amount: number
  actual_amount: number
  variance_amount: number
}

export interface BudgetComparisonCurrencySummary {
  currency: Currency
  budget_total: number
  actual_total: number
  variance_total: number
}

function shouldIncludeInBudgetExpenseActuals(
  transaction: CashbookTransaction,
) {
  if (!shouldIncludeInFundReporting(transaction)) return false
  if (transaction.kind === 'payment') return true
  return transaction.kind === 'adjustment' && isOutgoingTransactionEffect(transaction)
}

function matchesBudgetLineScope(
  transaction: CashbookTransaction,
  line: BudgetLine,
) {
  if (!line.scope_member_id) return true

  const scopeType = line.scope_member?.type ?? null

  if (scopeType === 'region') {
    return transaction.region_member_snapshot_id === line.scope_member_id
  }

  if (scopeType === 'assembly') {
    return transaction.assembly_member_snapshot_id === line.scope_member_id
  }

  return transaction.member_id === line.scope_member_id
}

export function buildBudgetComparisonRows(
  budget: Budget | null | undefined,
  transactions: CashbookTransaction[],
) {
  if (!budget) return [] as BudgetComparisonLineRow[]

  const rows = (budget.lines ?? []).map((line) => {
    const actualAmount = transactions.reduce((total, transaction) => {
      if (transaction.status !== 'posted') return total
      if (!shouldIncludeInBudgetExpenseActuals(transaction)) return total
      if (transaction.district_id !== budget.district_id) return total
      if (transaction.fund_id !== line.fund_id) return total
      if (transaction.currency !== line.currency) return total
      if (transaction.transaction_date < budget.start_date || transaction.transaction_date > budget.end_date) {
        return total
      }
      if (!matchesBudgetLineScope(transaction, line)) return total

      return total + Number(transaction.total_amount)
    }, 0)

    const budgetAmount = Number(line.amount)
    const varianceAmount = budgetAmount - actualAmount

    return {
      budget_id: budget.id,
      budget_name: budget.name,
      budget_status: budget.status,
      budget_line_id: line.id,
      start_date: budget.start_date,
      end_date: budget.end_date,
      fund_id: line.fund_id,
      fund_name: line.fund?.name ?? 'Unknown fund',
      line_description: line.line_description,
      currency: line.currency,
      scope_member_id: line.scope_member_id,
      scope_member_name: line.scope_member?.name ?? null,
      scope_member_type: line.scope_member?.type ?? null,
      budget_amount: budgetAmount,
      actual_amount: actualAmount,
      variance_amount: varianceAmount,
    }
  })

  return rows.sort((a, b) =>
    a.currency.localeCompare(b.currency)
    || a.fund_name.localeCompare(b.fund_name)
    || a.line_description.localeCompare(b.line_description)
    || (a.scope_member_name ?? '').localeCompare(b.scope_member_name ?? '')
  )
}

export function buildBudgetComparisonSummaryByCurrency(
  rows: BudgetComparisonLineRow[],
) {
  const summaryMap = new Map<Currency, BudgetComparisonCurrencySummary>()

  for (const row of rows) {
    if (!summaryMap.has(row.currency)) {
      summaryMap.set(row.currency, {
        currency: row.currency,
        budget_total: 0,
        actual_total: 0,
        variance_total: 0,
      })
    }

    const summary = summaryMap.get(row.currency)!
    summary.budget_total += row.budget_amount
    summary.actual_total += row.actual_amount
  }

  return [...summaryMap.values()]
    .map((summary) => ({
      ...summary,
      variance_total: summary.budget_total - summary.actual_total,
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency))
}
