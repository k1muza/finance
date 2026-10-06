import { describe, expect, it } from 'vitest'
import {
  buildCoordinationAnalytics,
  buildFinanceAnalytics,
  monthKeys,
  topWithOther,
  type FinanceAnalyticsRow,
} from '@/lib/analytics'
import type { DistrictEvent } from '@/types'

function row(overrides: Partial<FinanceAnalyticsRow>): FinanceAnalyticsRow {
  return {
    transaction_date: '2026-10-05',
    currency: 'USD',
    kind: 'receipt',
    total_amount: 100,
    fund_id: 'tithes',
    fund_name: 'Tithes',
    assembly_id: 'a1',
    assembly_name: 'Central',
    ...overrides,
  }
}

function event(overrides: Partial<DistrictEvent>): DistrictEvent {
  return {
    id: 'e',
    district_id: 'd',
    title: 'Event',
    description: null,
    location: null,
    start_date: '2026-10-11',
    end_date: '2026-10-11',
    start_time: null,
    end_time: null,
    created_by: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

describe('monthKeys', () => {
  it('spans year boundaries', () => {
    expect(monthKeys('2026-11-20', 3)).toEqual(['2026-11', '2026-12', '2027-01'])
  })
})

describe('buildFinanceAnalytics', () => {
  const months = ['2026-09', '2026-10']

  it('totals receipts and payments per month for one currency', () => {
    const result = buildFinanceAnalytics([
      row({ total_amount: '100.50' }),
      row({ transaction_date: '2026-09-02', total_amount: 40 }),
      row({ kind: 'payment', total_amount: 30 }),
      row({ currency: 'ZWG', total_amount: 9999 }),
    ], months, 'USD')

    expect(result.monthly).toEqual([
      { month: '2026-09', receipts: 40, payments: 0 },
      { month: '2026-10', receipts: 100.5, payments: 30 },
    ])
    expect(result.totals).toEqual({ receipts: 140.5, payments: 30, net: 110.5 })
  })

  it('ignores transfers, adjustments, opening balances, reversals and out-of-range dates', () => {
    const result = buildFinanceAnalytics([
      row({ kind: 'transfer' }),
      row({ kind: 'adjustment' }),
      row({ kind: 'opening_balance' }),
      row({ kind: 'reversal' }),
      row({ transaction_date: '2026-08-31' }),
    ], months, 'USD')

    expect(result.totals).toEqual({ receipts: 0, payments: 0, net: 0 })
  })

  it('orders currencies by how often they are used', () => {
    const result = buildFinanceAnalytics([
      row({ currency: 'ZWG' }),
      row({ currency: 'USD' }),
      row({ currency: 'USD' }),
      row({ currency: 'ZAR', kind: 'transfer' }),
    ], months, 'USD')

    expect(result.currencies).toEqual(['USD', 'ZWG'])
  })

  it('groups receipts by fund and assembly, with missing values labelled', () => {
    const result = buildFinanceAnalytics([
      row({ total_amount: 10 }),
      row({ total_amount: 30, fund_id: null, fund_name: null, assembly_id: null, assembly_name: null }),
    ], months, 'USD')

    expect(result.receiptsByFund.map((r) => [r.label, r.amount])).toEqual([['No fund', 30], ['Tithes', 10]])
    expect(result.receiptsByAssembly.map((r) => r.label)).toEqual(['No assembly', 'Central'])
  })
})

describe('topWithOther', () => {
  it('folds everything past the limit into Other', () => {
    const totals = new Map(
      [5, 4, 3, 2, 1].map((amount) => [String(amount), { key: String(amount), label: `L${amount}`, amount }]),
    )
    expect(topWithOther(totals, 3)).toEqual([
      { key: '5', label: 'L5', amount: 5 },
      { key: '4', label: 'L4', amount: 4 },
      { key: '__other', label: 'Other (3)', amount: 6 },
    ])
  })
})

describe('buildCoordinationAnalytics', () => {
  it('counts events per month, weekday, and upcoming window', () => {
    const result = buildCoordinationAnalytics([
      // Sunday 11 Oct, single day
      event({ id: 'a' }),
      // Fri 30 Oct – Sun 1 Nov: touches both months
      event({ id: 'b', start_date: '2026-10-30', end_date: '2026-11-01' }),
      // Outside range
      event({ id: 'c', start_date: '2026-12-25', end_date: '2026-12-25' }),
    ], ['2026-10', '2026-11'], '2026-10-06')

    expect(result.monthly).toEqual([
      { month: '2026-10', events: 2 },
      { month: '2026-11', events: 1 },
    ])
    expect(result.byWeekday[0]).toBe(1) // Sunday
    expect(result.byWeekday[5]).toBe(1) // Friday
    expect(result.totalInRange).toBe(2)
    expect(result.multiDayInRange).toBe(1)
    expect(result.upcoming.map((e) => e.id)).toEqual(['a', 'b'])
    expect(result.upcomingCount).toBe(2)
  })
})
