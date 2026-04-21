'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useFunds } from '@/hooks/useFunds'
import { createClient } from '@/lib/supabase/client'
import {
  isIncomingTransactionEffect,
  shouldIncludeInFundReporting,
} from '@/lib/finance/transactions'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { SelectDistrictHint } from '@/components/layout/SelectDistrictHint'
import { FundsSection } from '@/components/settings/SettingsPanel'
import { Wallet, TrendingUp, TrendingDown, ChevronRight, Lock } from 'lucide-react'
import type { CashbookTransaction, Currency } from '@/types'

interface FundBalance {
  fundId: string
  totalIn: number
  totalOut: number
  balance: number
  currency: string
}

function FundBalanceCards({ districtId }: { districtId: string }) {
  const { data: funds, loading } = useFunds({ district_id: districtId })
  const [balances, setBalances] = useState<FundBalance[]>([])
  const supabase = createClient()

  useEffect(() => {
    if (!funds.length) return

    async function load() {
      const { data: txns } = await supabase
        .from('cashbook_transactions')
        .select('fund_id, kind, effect_direction, total_amount, currency')
        .eq('district_id', districtId)
        .eq('status', 'posted')
        .not('fund_id', 'is', null)

      const map: Record<string, FundBalance> = {}
      for (const f of funds) {
        map[f.id] = { fundId: f.id, totalIn: 0, totalOut: 0, balance: 0, currency: 'USD' }
      }

      for (const t of txns ?? []) {
        if (!t.fund_id || !map[t.fund_id]) continue
        if (!shouldIncludeInFundReporting(t as Pick<CashbookTransaction, 'kind'>)) continue
        const entry = map[t.fund_id]
        entry.currency = t.currency
        if (isIncomingTransactionEffect(t as Pick<CashbookTransaction, 'kind' | 'effect_direction'>)) {
          entry.totalIn += Number(t.total_amount)
        } else {
          entry.totalOut += Number(t.total_amount)
        }
        entry.balance = entry.totalIn - entry.totalOut
      }

      setBalances(Object.values(map))
    }

    void load()
  }, [funds, districtId]) // eslint-disable-line

  if (loading) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-slate-800 rounded-xl border border-slate-700 p-5 h-32 animate-pulse" />
      ))}
    </div>
  )

  if (!funds.length) return (
    <div className="text-center py-12 text-slate-500 text-sm">
      No funds defined for this district. Add funds in Settings.
    </div>
  )

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {funds.map((fund) => {
        const bal = balances.find((b) => b.fundId === fund.id)
        const balance = bal?.balance ?? 0
        const currency = (bal?.currency ?? 'USD') as Currency
        return (
          <Link
            key={fund.id}
            href={`/dashboard/finance/funds/${fund.id}`}
            className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-3 hover:border-cyan-500/40 hover:bg-slate-800/80 transition-all group"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-100 truncate">{fund.name}</p>
                  {fund.is_restricted && (
                    <Lock className="h-3 w-3 text-amber-400 shrink-0" aria-label="Restricted fund" />
                  )}
                </div>
                {fund.description && (
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{fund.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1 text-slate-500 group-hover:text-cyan-400 transition-colors shrink-0">
                <Wallet className="h-4 w-4" />
                <ChevronRight className="h-4 w-4" />
              </div>
            </div>

            <div className={`text-2xl font-bold ${balance >= 0 ? 'text-slate-100' : 'text-red-400'}`}>
              {bal ? formatCurrency(balance, currency) : <span className="text-slate-600 text-base">—</span>}
            </div>

            {bal && (
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/50 text-xs">
                <div className="flex items-center gap-1 text-emerald-400">
                  <TrendingUp className="h-3 w-3" />
                  <span>{formatCurrency(bal.totalIn, currency)}</span>
                </div>
                <div className="flex items-center justify-end gap-1 text-red-400">
                  <TrendingDown className="h-3 w-3" />
                  <span>{formatCurrency(bal.totalOut, currency)}</span>
                </div>
              </div>
            )}
          </Link>
        )
      })}
    </div>
  )
}

export default function FundsPage() {
  const { districtId } = useAuth()

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Wallet className="h-6 w-6 text-cyan-400" />
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Funds</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Balances from posted cashbook transactions per fund.
          </p>
        </div>
      </div>

      {districtId ? (
        <>
          <FundBalanceCards districtId={districtId} />
          <FundsSection districtId={districtId} />
        </>
      ) : (
        <SelectDistrictHint description="Choose a district to view its funds." />
      )}
    </div>
  )
}
