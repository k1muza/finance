import { CashbookTransaction, Currency } from '@/types'
import {
  isIncomingTransactionEffect,
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

