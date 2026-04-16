'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DistrictFinanceBreakdown, FinanceCategoryBreakdown, OverviewStats } from '@/types'

const IN_KINDS = new Set(['receipt', 'opening_balance', 'adjustment'])

export function useOverview(districtId?: string | null) {
  const [data, setData] = useState<OverviewStats | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      setLoading(true)

      const [
        { data: districtsData },
        { data: txnData },
      ] = await Promise.all([
        supabase.from('districts').select('id, name').order('name'),
        supabase
          .from('cashbook_transactions')
          .select('district_id, total_amount, currency, kind, fund:funds(name)')
          .eq('status', 'posted'),
      ])

      type TxnRow = {
        district_id: string
        total_amount: number
        currency: string
        kind: string
        fund: { name: string } | { name: string }[] | null
      }

      const allTxns = (txnData ?? []) as TxnRow[]
      const scopedTxns = districtId
        ? allTxns.filter((t) => t.district_id === districtId)
        : allTxns

      const visibleDistricts = districtId
        ? (districtsData ?? []).filter((d) => d.id === districtId)
        : (districtsData ?? [])

      // Per-district totals
      const totalsByDistrict = new Map<string, DistrictFinanceBreakdown>()
      for (const district of visibleDistricts) {
        totalsByDistrict.set(district.id, {
          district_id: district.id,
          district_name: district.name,
          income_total: 0,
          expense_total: 0,
          net_balance: 0,
          income_count: 0,
          expense_count: 0,
        })
      }

      for (const t of allTxns) {
        const entry = totalsByDistrict.get(t.district_id)
        if (!entry) continue
        const amount = Number(t.total_amount)
        if (IN_KINDS.has(t.kind)) {
          entry.income_total += amount
          entry.income_count += 1
        } else {
          entry.expense_total += amount
          entry.expense_count += 1
        }
      }

      const districtBreakdown = [...totalsByDistrict.values()]
        .map((entry) => ({ ...entry, net_balance: entry.income_total - entry.expense_total }))
        .sort((a, b) => b.net_balance - a.net_balance || a.district_name.localeCompare(b.district_name))

      // Scoped totals (USD only for the headline stats — multi-currency is handled in Reports)
      const totalIncome = scopedTxns
        .filter((t) => IN_KINDS.has(t.kind))
        .reduce((sum, t) => sum + Number(t.total_amount), 0)

      const totalExpenses = scopedTxns
        .filter((t) => !IN_KINDS.has(t.kind))
        .reduce((sum, t) => sum + Number(t.total_amount), 0)

      setData({
        totalIncome,
        totalExpenses,
        netBalance: totalIncome - totalExpenses,
        incomeCount: scopedTxns.filter((t) => IN_KINDS.has(t.kind)).length,
        expenseCount: scopedTxns.filter((t) => !IN_KINDS.has(t.kind)).length,
        topIncomeCategories: groupByFund(scopedTxns.filter((t) => IN_KINDS.has(t.kind))),
        topExpenseCategories: groupByFund(scopedTxns.filter((t) => !IN_KINDS.has(t.kind))),
        districtBreakdown,
      })

      setLoading(false)
    }

    load()
  }, [districtId]) // eslint-disable-line

  return { data, loading }
}

function groupByFund(
  rows: { fund: { name: string } | { name: string }[] | null; total_amount: number }[]
): FinanceCategoryBreakdown[] {
  const grouped = rows.reduce<Map<string, { amount: number; count: number }>>((map, row) => {
    const category = Array.isArray(row.fund)
      ? row.fund[0]?.name ?? 'Unassigned'
      : row.fund?.name ?? 'Unassigned'
    const current = map.get(category) ?? { amount: 0, count: 0 }
    current.amount += Number(row.total_amount)
    current.count += 1
    map.set(category, current)
    return map
  }, new Map())

  return [...grouped.entries()]
    .map(([category, value]) => ({ category, amount: value.amount, count: value.count }))
    .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category))
    .slice(0, 5)
}
