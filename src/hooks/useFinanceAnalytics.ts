'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import type { FinanceAnalyticsRow } from '@/lib/analytics'

const PAGE_SIZE = 1000

type TxnRow = {
  transaction_date: string
  currency: string
  kind: string
  total_amount: number | string
  fund_id: string | null
  fund: { name: string } | { name: string }[] | null
  assembly_member_snapshot_id: string | null
}

/** Posted receipts and payments for a district between two dates (inclusive). */
export function useFinanceAnalytics(districtId: string | null, from: string, to: string) {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const [data, setData] = useState<FinanceAnalyticsRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetch = useCallback(async () => {
    if (authLoading) return

    if (!userId || !districtId) {
      setData([])
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // PostgREST caps each response, so page through the whole range.
      const txns: TxnRow[] = []
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data: page, error: err } = await supabase
          .from('cashbook_transactions')
          .select('transaction_date, currency, kind, total_amount, fund_id, fund:funds(name), assembly_member_snapshot_id')
          .eq('district_id', districtId)
          .eq('status', 'posted')
          .in('kind', ['receipt', 'payment'])
          .gte('transaction_date', from)
          .lte('transaction_date', to)
          .order('transaction_date')
          .order('id')
          .range(offset, offset + PAGE_SIZE - 1)
        if (err) throw new Error(err.message)
        txns.push(...((page ?? []) as TxnRow[]))
        if (!page || page.length < PAGE_SIZE) break
      }

      const assemblyIds = [...new Set(txns.map((t) => t.assembly_member_snapshot_id).filter((id): id is string => !!id))]
      const assemblyNames = new Map<string, string>()
      if (assemblyIds.length > 0) {
        const { data: members, error: err } = await supabase.from('members').select('id, name').in('id', assemblyIds)
        if (err) throw new Error(err.message)
        for (const m of members ?? []) assemblyNames.set(m.id, m.name)
      }

      setData(txns.map((t) => {
        const fund = Array.isArray(t.fund) ? t.fund[0] : t.fund
        return {
          transaction_date: t.transaction_date,
          currency: t.currency,
          kind: t.kind,
          total_amount: t.total_amount,
          fund_id: t.fund_id,
          fund_name: fund?.name ?? null,
          assembly_id: t.assembly_member_snapshot_id,
          assembly_name: t.assembly_member_snapshot_id ? assemblyNames.get(t.assembly_member_snapshot_id) ?? null : null,
        }
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
      setData([])
    }
    setLoading(false)
  }, [authLoading, districtId, from, to, userId]) // eslint-disable-line

  useEffect(() => {
    if (authLoading) return

    const timeout = setTimeout(() => {
      void fetch()
    }, 0)

    return () => clearTimeout(timeout)
  }, [authLoading, fetch])

  return { data, loading, error, refetch: fetch }
}
