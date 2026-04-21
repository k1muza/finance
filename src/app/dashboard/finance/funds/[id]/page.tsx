'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useFunds } from '@/hooks/useFunds'
import { createClient } from '@/lib/supabase/client'
import {
  isIncomingTransactionEffect,
  shouldIncludeInFundReporting,
  transactionDisplayLabel,
} from '@/lib/finance/transactions'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { Badge } from '@/components/ui/Badge'
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Scale,
  ArrowLeft,
  Lock,
  Loader,
} from 'lucide-react'
import {
  CashbookTransaction,
  Currency,
  TransactionKind,
  TRANSACTION_STATUS_LABELS,
} from '@/types'

// ── helpers ──────────────────────────────────────────────────────────────────

const KIND_BADGE: Record<TransactionKind, 'green' | 'red' | 'yellow' | 'default'> = {
  receipt: 'green',
  payment: 'red',
  reversal: 'yellow',
  opening_balance: 'default',
  adjustment: 'default',
  transfer: 'default',
}

const STATUS_BADGE: Record<string, 'default' | 'green' | 'yellow' | 'teal' | 'red'> = {
  draft: 'default',
  submitted: 'yellow',
  approved: 'teal',
  posted: 'green',
  reversed: 'red',
  voided: 'red',
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

const toIsoDate = (d: Date) => d.toISOString().split('T')[0]
const firstOfMonth = () => { const d = new Date(); d.setDate(1); return toIsoDate(d) }

// ── main page ─────────────────────────────────────────────────────────────────

export default function FundDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { districtId } = useAuth()
  const { data: funds, loading: fundsLoading } = useFunds({ district_id: districtId })
  const [supabase] = useState(() => createClient())

  const [transactions, setTransactions] = useState<CashbookTransaction[]>([])
  const [txnLoading, setTxnLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState(firstOfMonth())
  const [dateTo, setDateTo] = useState(toIsoDate(new Date()))

  const fund = funds.find((f) => f.id === id)

  useEffect(() => {
    if (!id) return

    let cancelled = false
    const timeout = setTimeout(() => {
      setTxnLoading(true)

      supabase
        .from('cashbook_transactions')
        .select('*, account:accounts(id,name,currency)')
        .eq('fund_id', id)
        .gte('transaction_date', dateFrom)
        .lte('transaction_date', dateTo)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          if (cancelled) return
          setTransactions((data ?? []) as CashbookTransaction[])
          setTxnLoading(false)
        })
    }, 0)

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [dateFrom, dateTo, id, supabase])

  // Balance from ALL time posted transactions (not filtered by date)
  const [allTime, setAllTime] = useState<{ totalIn: number; totalOut: number; currency: string } | null>(null)
  useEffect(() => {
    if (!id) return
    supabase
      .from('cashbook_transactions')
      .select('kind, effect_direction, total_amount, currency')
      .eq('fund_id', id)
      .eq('status', 'posted')
      .then(({ data }) => {
        let totalIn = 0, totalOut = 0, currency = 'USD'
        for (const t of data ?? []) {
          if (!shouldIncludeInFundReporting(t as Pick<CashbookTransaction, 'kind'>)) continue
          currency = t.currency
          if (isIncomingTransactionEffect(t as Pick<CashbookTransaction, 'kind' | 'effect_direction'>)) totalIn += Number(t.total_amount)
          else totalOut += Number(t.total_amount)
        }
        setAllTime({ totalIn, totalOut, currency })
      })
  }, [id, supabase])

  const balance = allTime ? allTime.totalIn - allTime.totalOut : 0
  const currency = (allTime?.currency ?? 'USD') as Currency

  // Period totals (filtered by date range, posted only)
  const postedInPeriod = transactions.filter((t) => t.status === 'posted' && shouldIncludeInFundReporting(t))
  const periodIn = postedInPeriod.filter((t) => isIncomingTransactionEffect(t)).reduce((s, t) => s + t.total_amount, 0)
  const periodOut = postedInPeriod.filter((t) => !isIncomingTransactionEffect(t)).reduce((s, t) => s + t.total_amount, 0)

  if (fundsLoading) return (
    <div className="p-6 flex items-center gap-2 text-slate-500 text-sm">
      <Loader className="h-4 w-4 animate-spin" /> Loading...
    </div>
  )

  if (!fund && !fundsLoading) return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <Link href="/dashboard/finance/funds" className="text-sm text-slate-400 hover:text-slate-200 flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> Back to funds
      </Link>
      <p className="text-slate-400">Fund not found.</p>
    </div>
  )

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* back link */}
      <Link href="/dashboard/finance/funds" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 transition-colors">
        <ArrowLeft className="h-4 w-4" /> All funds
      </Link>

      {/* header */}
      <div className="flex items-start gap-3">
        <div className="bg-cyan-500/10 rounded-lg p-2.5 text-cyan-400 shrink-0 mt-0.5">
          <Wallet className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-100">{fund?.name}</h1>
            {fund?.is_restricted && (
              <span className="inline-flex items-center gap-1 text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full px-2 py-0.5">
                <Lock className="h-3 w-3" /> Restricted
              </span>
            )}
          </div>
          {fund?.description && (
            <p className="text-sm text-slate-400 mt-1">{fund.description}</p>
          )}
        </div>
      </div>

      {/* balance summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`rounded-xl p-4 border col-span-2 lg:col-span-1 ${balance >= 0 ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
            <Scale className="h-3.5 w-3.5 text-cyan-400" /> Fund Balance
          </p>
          <p className={`text-xl font-bold ${balance >= 0 ? 'text-cyan-300' : 'text-red-400'}`}>
            {allTime ? formatCurrency(balance, currency) : '—'}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">All time, posted only</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" /> Period In
          </p>
          <p className="text-lg font-bold text-emerald-400">{formatCurrency(periodIn, currency)}</p>
          <p className="text-xs text-slate-500 mt-0.5">Posted in period</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
            <TrendingDown className="h-3.5 w-3.5 text-red-400" /> Period Out
          </p>
          <p className="text-lg font-bold text-red-400">{formatCurrency(periodOut, currency)}</p>
          <p className="text-xs text-slate-500 mt-0.5">Posted in period</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <p className="text-xs text-slate-400 mb-1">Transactions</p>
          <p className="text-lg font-bold text-slate-100">{transactions.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">All statuses in period</p>
        </div>
      </div>

      {/* date range filter */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-slate-400 mb-1">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* transaction table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <p className="text-sm font-medium text-slate-300">Transactions</p>
          <p className="text-xs text-slate-500">{transactions.length} record{transactions.length !== 1 ? 's' : ''}</p>
        </div>

        {txnLoading ? (
          <div className="px-4 py-10 flex items-center justify-center gap-2 text-slate-500 text-sm">
            <Loader className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : transactions.length === 0 ? (
          <div className="px-4 py-10 text-center text-slate-500 text-sm">
            No transactions for this fund in the selected period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Date</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Kind</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Counterparty / Narration</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Account</th>
                  <th className="text-right px-4 py-3 text-emerald-400/80 font-medium">In</th>
                  <th className="text-right px-4 py-3 text-red-400/80 font-medium">Out</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn) => {
                  const isIn = isIncomingTransactionEffect(txn)
                  const txnCurrency = ((txn.account as { currency?: string } | null)?.currency ?? txn.currency ?? 'USD') as Currency
                  return (
                    <tr key={txn.id} className="border-b border-slate-700/50 last:border-0 hover:bg-slate-700/20 transition-colors">
                      <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{formatDate(txn.transaction_date)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={KIND_BADGE[txn.kind]}>{transactionDisplayLabel(txn)}</Badge>
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        {txn.counterparty && <p className="text-slate-200 truncate">{txn.counterparty}</p>}
                        {txn.narration && <p className="text-slate-500 text-xs truncate">{txn.narration}</p>}
                        {!txn.counterparty && !txn.narration && <span className="text-slate-700">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                        {(txn.account as { name?: string } | null)?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {isIn
                          ? <span className="text-emerald-400">{formatCurrency(txn.total_amount, txnCurrency)}</span>
                          : <span className="text-slate-700">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {!isIn
                          ? <span className="text-red-400">{formatCurrency(txn.total_amount, txnCurrency)}</span>
                          : <span className="text-slate-700">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_BADGE[txn.status]}>{TRANSACTION_STATUS_LABELS[txn.status]}</Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
