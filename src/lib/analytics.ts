// Aggregations behind the Analytics pages. Pure functions so they can be tested
// without Supabase; the hooks fetch rows and hand them here.

import { addDays, addMonths, startOfMonth } from '@/lib/calendar'
import type { DistrictEvent } from '@/types'

/** 'YYYY-MM' keys for `count` consecutive months starting at the month of `fromIso`. */
export function monthKeys(fromIso: string, count: number): string[] {
  const first = startOfMonth(fromIso)
  return Array.from({ length: count }, (_, i) => addMonths(first, i).slice(0, 7))
}

export function formatMonthShort(key: string) {
  return new Date(`${key}-01T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' })
}

export function formatMonthLong(key: string) {
  return new Date(`${key}-01T00:00:00Z`).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

// ── finance ──────────────────────────────────────────────────────────────────

export interface FinanceAnalyticsRow {
  transaction_date: string
  currency: string
  kind: string
  total_amount: number | string
  fund_id: string | null
  fund_name: string | null
  assembly_id: string | null
  assembly_name: string | null
}

export interface MonthlyFlow {
  month: string
  receipts: number
  payments: number
}

export interface RankedAmount {
  key: string
  label: string
  amount: number
}

export interface FinanceAnalytics {
  currencies: string[]
  monthly: MonthlyFlow[]
  totals: { receipts: number; payments: number; net: number }
  receiptsByFund: RankedAmount[]
  paymentsByFund: RankedAmount[]
  receiptsByAssembly: RankedAmount[]
}

/**
 * Callers pass only *posted* rows. A reversed transaction is no longer posted and its
 * reversal is excluded here, so the pair drops out together. Transfers, adjustments and
 * opening balances move money around rather than in or out, so only receipts and
 * payments count.
 */
export function isCountedFlow(kind: string) {
  return kind === 'receipt' || kind === 'payment'
}

/** Currencies by number of counted transactions, most used first. */
export function currenciesByUse(rows: FinanceAnalyticsRow[]): string[] {
  const counts = new Map<string, number>()
  for (const row of rows) {
    if (!isCountedFlow(row.kind)) continue
    counts.set(row.currency, (counts.get(row.currency) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c]) => c)
}

/** Largest `limit - 1` entries, with the remainder folded into a single "Other" row. */
export function topWithOther(totals: Map<string, RankedAmount>, limit: number): RankedAmount[] {
  const sorted = [...totals.values()].filter((r) => r.amount > 0).sort((a, b) => b.amount - a.amount)
  if (sorted.length <= limit) return sorted
  const head = sorted.slice(0, limit - 1)
  const rest = sorted.slice(limit - 1).reduce((sum, r) => sum + r.amount, 0)
  return [...head, { key: '__other', label: `Other (${sorted.length - head.length})`, amount: rest }]
}

function addTo(map: Map<string, RankedAmount>, key: string, label: string, amount: number) {
  const entry = map.get(key)
  if (entry) entry.amount += amount
  else map.set(key, { key, label, amount })
}

export function buildFinanceAnalytics(
  rows: FinanceAnalyticsRow[],
  months: string[],
  currency: string,
  limit = 8,
): FinanceAnalytics {
  const monthly = new Map(months.map((m) => [m, { month: m, receipts: 0, payments: 0 }]))
  const receiptsByFund = new Map<string, RankedAmount>()
  const paymentsByFund = new Map<string, RankedAmount>()
  const receiptsByAssembly = new Map<string, RankedAmount>()

  for (const row of rows) {
    if (row.currency !== currency || !isCountedFlow(row.kind)) continue
    const bucket = monthly.get(row.transaction_date.slice(0, 7))
    if (!bucket) continue

    const amount = Number(row.total_amount)
    const fundKey = row.fund_id ?? '__none'
    const fundLabel = row.fund_name ?? 'No fund'

    if (row.kind === 'receipt') {
      bucket.receipts += amount
      addTo(receiptsByFund, fundKey, fundLabel, amount)
      addTo(receiptsByAssembly, row.assembly_id ?? '__none', row.assembly_name ?? 'No assembly', amount)
    } else {
      bucket.payments += amount
      addTo(paymentsByFund, fundKey, fundLabel, amount)
    }
  }

  const monthlyRows = months.map((m) => monthly.get(m)!)
  const receipts = monthlyRows.reduce((sum, m) => sum + m.receipts, 0)
  const payments = monthlyRows.reduce((sum, m) => sum + m.payments, 0)

  return {
    currencies: currenciesByUse(rows),
    monthly: monthlyRows,
    totals: { receipts, payments, net: receipts - payments },
    receiptsByFund: topWithOther(receiptsByFund, limit),
    paymentsByFund: topWithOther(paymentsByFund, limit),
    receiptsByAssembly: topWithOther(receiptsByAssembly, limit),
  }
}

// ── coordination ─────────────────────────────────────────────────────────────

export interface CoordinationAnalytics {
  /** Events touching each month (a multi-day event counts once per month it spans). */
  monthly: Array<{ month: string; events: number }>
  /** Events starting on each weekday, Sunday first. */
  byWeekday: number[]
  upcoming: DistrictEvent[]
  upcomingCount: number
  totalInRange: number
  multiDayInRange: number
}

export function buildCoordinationAnalytics(
  events: DistrictEvent[],
  months: string[],
  today: string,
  upcomingDays = 30,
): CoordinationAnalytics {
  const rangeStart = `${months[0]}-01`
  const rangeEnd = addDays(addMonths(`${months[months.length - 1]}-01`, 1), -1)
  const inRange = events.filter((e) => e.start_date <= rangeEnd && e.end_date >= rangeStart)

  const monthly = months.map((month) => {
    const first = `${month}-01`
    const last = addDays(addMonths(first, 1), -1)
    return { month, events: inRange.filter((e) => e.start_date <= last && e.end_date >= first).length }
  })

  const byWeekday = [0, 0, 0, 0, 0, 0, 0]
  for (const e of inRange) byWeekday[new Date(`${e.start_date}T00:00:00Z`).getUTCDay()] += 1

  const horizon = addDays(today, upcomingDays)
  const upcomingAll = events
    .filter((e) => e.end_date >= today && e.start_date <= horizon)
    .sort((a, b) => (a.start_date + (a.start_time ?? '')).localeCompare(b.start_date + (b.start_time ?? '')))

  return {
    monthly,
    byWeekday,
    upcoming: upcomingAll.slice(0, 6),
    upcomingCount: upcomingAll.length,
    totalInRange: inRange.length,
    multiDayInRange: inRange.filter((e) => e.end_date > e.start_date).length,
  }
}
