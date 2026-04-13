'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DistrictFinanceBreakdown, OverviewStats } from '@/types'

export function useOverview(districtId?: string | null) {
  const [data, setData] = useState<OverviewStats | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      setLoading(true)

      const [
        { data: districtsData },
        { data: incomeData },
        { data: expensesData },
      ] = await Promise.all([
        supabase.from('districts').select('id, name').order('name'),
        supabase.from('income').select('district_id, amount, category'),
        supabase.from('expenses').select('district_id, amount, category'),
      ])

      const scopedIncome = districtId
        ? (incomeData ?? []).filter((row) => row.district_id === districtId)
        : (incomeData ?? [])
      const scopedExpenses = districtId
        ? (expensesData ?? []).filter((row) => row.district_id === districtId)
        : (expensesData ?? [])
      const visibleDistricts = districtId
        ? (districtsData ?? []).filter((district) => district.id === districtId)
        : (districtsData ?? [])

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

      for (const row of scopedIncome) {
        const entry = totalsByDistrict.get(row.district_id)
        if (!entry) continue
        entry.income_total += row.amount ?? 0
        entry.income_count += 1
      }

      for (const row of scopedExpenses) {
        const entry = totalsByDistrict.get(row.district_id)
        if (!entry) continue
        entry.expense_total += row.amount ?? 0
        entry.expense_count += 1
      }

      const districtBreakdown = [...totalsByDistrict.values()]
        .map((entry) => ({
          ...entry,
          net_balance: entry.income_total - entry.expense_total,
        }))
        .sort((a, b) => b.net_balance - a.net_balance || a.district_name.localeCompare(b.district_name))

      const totalIncome = scopedIncome.reduce((sum, row) => sum + (row.amount ?? 0), 0)
      const totalExpenses = scopedExpenses.reduce((sum, row) => sum + (row.amount ?? 0), 0)

      setData({
        totalIncome,
        totalExpenses,
        netBalance: totalIncome - totalExpenses,
        incomeCount: scopedIncome.length,
        expenseCount: scopedExpenses.length,
        topIncomeCategories: groupByCategory(scopedIncome),
        topExpenseCategories: groupByCategory(scopedExpenses),
        districtBreakdown,
      })

      setLoading(false)
    }

    load()
  }, [districtId]) // eslint-disable-line

  return { data, loading }
}

function groupByCategory(rows: { category: string | null; amount: number | null }[]) {
  const grouped = rows.reduce<Map<string, { amount: number; count: number }>>((map, row) => {
    const category = row.category?.trim() || 'Uncategorised'
    const current = map.get(category) ?? { amount: 0, count: 0 }
    current.amount += row.amount ?? 0
    current.count += 1
    map.set(category, current)
    return map
  }, new Map())

  return [...grouped.entries()]
    .map(([category, value]) => ({
      category,
      amount: value.amount,
      count: value.count,
    }))
    .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category))
    .slice(0, 5)
}
