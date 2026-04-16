'use client'

import { useEffect, useState } from 'react'
import { SelectDistrictHint } from '@/components/layout/SelectDistrictHint'
import { AccountsSection } from '@/components/settings/SettingsPanel'
import { useAuth } from '@/contexts/AuthContext'
import { useAccounts } from '@/hooks/useAccounts'
import { useOpeningBalances } from '@/hooks/useOpeningBalances'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { Landmark, TrendingUp, TrendingDown, Scale } from 'lucide-react'
import { Account, Currency } from '@/types'

interface AccountBalance {
  accountId: string
  openingBalance: number
  totalIn: number
  totalOut: number
  closing: number
  currency: Currency
}

function AccountBalanceCards({ districtId }: { districtId: string }) {
  const { data: accounts, loading: accountsLoading } = useAccounts({ district_id: districtId })
  const { data: openingBalances } = useOpeningBalances({ district_id: districtId })
  const [balances, setBalances] = useState<AccountBalance[]>([])
  const supabase = createClient()

  useEffect(() => {
    if (accounts.length === 0) return

    const today = new Date().toISOString().split('T')[0]

    async function loadBalances() {
      const results: AccountBalance[] = []

      for (const account of accounts) {
        // Most recent opening balance on or before today
        const obSorted = [...openingBalances]
          .filter((b) => b.account_id === account.id && b.effective_date <= today)
          .sort((a, b) => b.effective_date.localeCompare(a.effective_date))
        const openingBalance = obSorted[0]?.amount ?? 0

        // Sum posted cashbook transactions
        const { data: txns } = await supabase
          .from('cashbook_transactions')
          .select('kind, total_amount')
          .eq('account_id', account.id)
          .eq('status', 'posted')

        let totalIn = 0
        let totalOut = 0
        for (const t of txns ?? []) {
          if (['receipt', 'opening_balance', 'adjustment'].includes(t.kind)) {
            totalIn += Number(t.total_amount)
          } else {
            totalOut += Number(t.total_amount)
          }
        }

        results.push({
          accountId: account.id,
          openingBalance,
          totalIn,
          totalOut,
          closing: openingBalance + totalIn - totalOut,
          currency: account.currency,
        })
      }

      setBalances(results)
    }

    void loadBalances()
  }, [accounts, openingBalances]) // eslint-disable-line

  if (accountsLoading || accounts.length === 0) return null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {accounts.map((account: Account) => {
        const bal = balances.find((b) => b.accountId === account.id)
        const closing = bal?.closing ?? 0
        const currency = account.currency as Currency
        return (
          <div key={account.id} className={`bg-slate-800 rounded-xl border p-5 space-y-3 ${account.status === 'archived' ? 'opacity-60 border-slate-700' : 'border-slate-700'}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-100">{account.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{account.currency} · {account.type.replace('_', ' ')}</p>
              </div>
              <div className="bg-cyan-500/10 rounded-lg p-2 text-cyan-400 shrink-0">
                <Landmark className="h-4 w-4" />
              </div>
            </div>

            <div className={`text-2xl font-bold ${closing >= 0 ? 'text-slate-100' : 'text-red-400'}`}>
              {bal ? formatCurrency(closing, currency) : <span className="text-slate-600 text-base">Loading...</span>}
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

            {account.status === 'archived' && (
              <p className="text-xs text-slate-500 italic">Archived</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function FinanceAccountsPage() {
  const { districtId } = useAuth()

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Scale className="h-6 w-6 text-cyan-400" />
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Accounts</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Balances from posted cashbook transactions. Manage account details below.
          </p>
        </div>
      </div>

      {districtId ? (
        <>
          <AccountBalanceCards districtId={districtId} />
          <AccountsSection districtId={districtId} />
        </>
      ) : (
        <SelectDistrictHint description="Choose a district from the top bar to manage that district's finance accounts." />
      )}
    </div>
  )
}
