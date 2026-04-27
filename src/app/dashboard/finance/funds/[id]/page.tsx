'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useDistricts } from '@/hooks/useDistricts'
import { useFunds } from '@/hooks/useFunds'
import { useCurrencies } from '@/hooks/useCurrencies'
import { useFundRecognitionTiers } from '@/hooks/useFundRecognitionTiers'
import { usePermissions } from '@/hooks/usePermissions'
import { createClient } from '@/lib/supabase/client'
import { performCashbookBulkAction } from '@/lib/finance/cashbook-client'
import {
  CASHBOOK_BULK_ACTION_SUCCESS_LABELS,
  buildCashbookBulkActionOptions,
  getCashbookBulkActionTransactionIds,
  type CashbookBulkAction,
} from '@/lib/finance/cashbook-bulk-actions'
import {
  isIncomingTransactionEffect,
  shouldIncludeInFundReporting,
  transactionDisplayLabel,
} from '@/lib/finance/transactions'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/Toast'
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Scale,
  ArrowLeft,
  Lock,
  Loader,
  Trophy,
  Plus,
  Trash2,
  Award,
  Pencil,
} from 'lucide-react'
import { Pagination } from '@/components/ui/Pagination'
import {
  CashbookTransaction,
  Currency,
  FundRecognitionTier,
  RecognitionTierColor,
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

const TIER_COLOR_OPTIONS: { value: RecognitionTierColor; label: string; className: string }[] = [
  { value: 'amber',   label: 'Gold',     className: 'bg-amber-400' },
  { value: 'slate',   label: 'Silver',   className: 'bg-slate-400' },
  { value: 'orange',  label: 'Bronze',   className: 'bg-orange-500' },
  { value: 'sky',     label: 'Platinum', className: 'bg-sky-400' },
  { value: 'violet',  label: 'Diamond',  className: 'bg-violet-400' },
  { value: 'emerald', label: 'Emerald',  className: 'bg-emerald-400' },
  { value: 'rose',    label: 'Rose',     className: 'bg-rose-400' },
]

const TIER_COLOR_PILL: Record<RecognitionTierColor, string> = {
  amber:   'border-amber-200 bg-amber-50 text-amber-700',
  slate:   'border-slate-300 bg-slate-100 text-slate-600',
  orange:  'border-orange-200 bg-orange-50 text-orange-700',
  sky:     'border-sky-200 bg-sky-50 text-sky-700',
  violet:  'border-violet-200 bg-violet-50 text-violet-700',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  rose:    'border-rose-200 bg-rose-50 text-rose-700',
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

const toIsoDate = (d: Date) => d.toISOString().split('T')[0]
const firstOfMonth = () => { const d = new Date(); d.setDate(1); return toIsoDate(d) }

// ── main page ─────────────────────────────────────────────────────────────────

export default function FundDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { districtId } = useAuth()
  const { can } = usePermissions()
  const toast = useToast()
  const { data: districts } = useDistricts()
  const { data: funds, loading: fundsLoading } = useFunds({ district_id: districtId })
  const [supabase] = useState(() => createClient())

  const { data: currencies } = useCurrencies()
  const { data: recognitionTiers, loading: tiersLoading, add: addTier, update: updateTier, remove: removeTier } = useFundRecognitionTiers(id)

  const [showAddTier, setShowAddTier] = useState(false)
  const [tierName, setTierName] = useState('')
  const [tierMinAmount, setTierMinAmount] = useState('')
  const [tierCurrency, setTierCurrency] = useState('')
  const [tierColor, setTierColor] = useState<RecognitionTierColor>('amber')
  const [tierSaving, setTierSaving] = useState(false)
  const [tierError, setTierError] = useState<string | null>(null)
  const [deletingTierId, setDeletingTierId] = useState<string | null>(null)
  const [editingTierId, setEditingTierId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editMinAmount, setEditMinAmount] = useState('')
  const [editCurrency, setEditCurrency] = useState('')
  const [editColor, setEditColor] = useState<RecognitionTierColor>('amber')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [transactions, setTransactions] = useState<CashbookTransaction[]>([])
  const [txnLoading, setTxnLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState(firstOfMonth())
  const [dateTo, setDateTo] = useState(toIsoDate(new Date()))
  const [txnPage, setTxnPage] = useState(1)
  const TXN_PAGE_SIZE = 10
  const [bulkAction, setBulkAction] = useState<CashbookBulkAction | ''>('')
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([])
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [reloadVersion, setReloadVersion] = useState(0)

  const fund = funds.find((f) => f.id === id)
  const currentDistrict = districts.find((district) => district.id === districtId)
  const autoPostTransactions = Boolean(currentDistrict?.auto_post_cashbook_transactions)
  const canDraftTransactions = can('transactions.draft')
  const canReverseTransactions = can('transactions.reverse')

  useEffect(() => {
    if (!id) return

    let cancelled = false
    const timeout = setTimeout(() => {
      setTxnLoading(true)

      supabase
        .from('cashbook_transactions')
        .select(
          '*, account:accounts(id,name,currency), fund:funds(id,name), member:members!cashbook_transactions_member_id_fkey(id,name,type,title,parent_id), counterparty_record:counterparties(id,name,type)',
        )
        .eq('fund_id', id)
        .gte('transaction_date', dateFrom)
        .lte('transaction_date', dateTo)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          if (cancelled) return
          setTransactions(
            ((data ?? []) as CashbookTransaction[]).map((txn) => ({
              ...txn,
              counterparty:
                txn.counterparty
                ?? txn.member_name_snapshot
                ?? txn.member?.name
                ?? txn.counterparty_record?.name
                ?? null,
            })),
          )
          setTxnLoading(false)
        })
    }, 0)

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [dateFrom, dateTo, id, reloadVersion, supabase])

  useEffect(() => {
    setSelectedTransactionIds([])
    setTxnPage(1)
  }, [id, dateFrom, dateTo, bulkAction])

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
  const txnPageCount = Math.ceil(transactions.length / TXN_PAGE_SIZE)
  const pagedTransactions = transactions.slice((txnPage - 1) * TXN_PAGE_SIZE, txnPage * TXN_PAGE_SIZE)

  // Period totals (filtered by date range, posted only)
  const postedInPeriod = transactions.filter((t) => t.status === 'posted' && shouldIncludeInFundReporting(t))
  const periodIn = postedInPeriod.filter((t) => isIncomingTransactionEffect(t)).reduce((s, t) => s + t.total_amount, 0)
  const periodOut = postedInPeriod.filter((t) => !isIncomingTransactionEffect(t)).reduce((s, t) => s + t.total_amount, 0)
  const bulkActionContext = {
    autoPostTransactions,
    canDraftTransactions,
    canReverseTransactions,
  }
  const bulkActionOptions = buildCashbookBulkActionOptions(transactions, bulkActionContext)
  const showBulkControls = bulkActionOptions.length > 0
  const actionableTransactionIds = bulkAction
    ? getCashbookBulkActionTransactionIds(transactions, bulkAction, bulkActionContext)
    : []
  const allActionableSelected = bulkAction !== ''
    && actionableTransactionIds.length > 0
    && actionableTransactionIds.every((id) => selectedTransactionIds.includes(id))
  const hasSelectedTransactions = selectedTransactionIds.length > 0

  useEffect(() => {
    const nextAction = bulkActionOptions[0]?.value ?? ''
    if (!nextAction) {
      if (bulkAction !== '') setBulkAction('')
      return
    }

    if (!bulkActionOptions.some((option) => option.value === bulkAction)) {
      setBulkAction(nextAction)
    }
  }, [bulkAction, bulkActionOptions])

  const toggleTransactionSelection = (transactionId: string) => {
    setSelectedTransactionIds((current) =>
      current.includes(transactionId)
        ? current.filter((id) => id !== transactionId)
        : [...current, transactionId],
    )
  }

  const toggleAllActionableTransactions = () => {
    setSelectedTransactionIds(allActionableSelected ? [] : actionableTransactionIds)
  }

  const handleBulkAction = async () => {
    if (!bulkAction || selectedTransactionIds.length === 0) return

    setBulkSubmitting(true)
    try {
      const result = await performCashbookBulkAction(selectedTransactionIds, bulkAction)
      toast.success(
        `${CASHBOOK_BULK_ACTION_SUCCESS_LABELS[bulkAction]} ${result.count} transaction${result.count === 1 ? '' : 's'}`,
      )
      setSelectedTransactionIds([])
      setReloadVersion((current) => current + 1)
    } catch (error) {
      toast.error(String(error))
    } finally {
      setBulkSubmitting(false)
    }
  }

  async function handleAddTier(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseFloat(tierMinAmount)
    if (!tierName.trim() || !tierCurrency || isNaN(amount) || amount < 0) {
      setTierError('Please fill in all fields with valid values.')
      return
    }
    setTierSaving(true)
    setTierError(null)
    try {
      await addTier({ name: tierName, min_amount: amount, currency: tierCurrency, color: tierColor })
      setShowAddTier(false)
      setTierName('')
      setTierMinAmount('')
      setTierCurrency('')
      setTierColor('amber')
    } catch (err) {
      setTierError(String(err))
    } finally {
      setTierSaving(false)
    }
  }

  function startEditTier(tier: FundRecognitionTier) {
    setEditingTierId(tier.id)
    setEditName(tier.name)
    setEditMinAmount(String(tier.min_amount))
    setEditCurrency(tier.currency)
    setEditColor(tier.color)
    setEditError(null)
  }

  function cancelEditTier() {
    setEditingTierId(null)
    setEditError(null)
  }

  async function handleSaveEditTier(e: React.FormEvent) {
    e.preventDefault()
    if (!editingTierId) return
    const amount = parseFloat(editMinAmount)
    if (!editName.trim() || !editCurrency || isNaN(amount) || amount < 0) {
      setEditError('Please fill in all fields with valid values.')
      return
    }
    setEditSaving(true)
    setEditError(null)
    try {
      await updateTier(editingTierId, { name: editName, min_amount: amount, currency: editCurrency, color: editColor })
      setEditingTierId(null)
    } catch (err) {
      setEditError(String(err))
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDeleteTier(tier: FundRecognitionTier) {
    setDeletingTierId(tier.id)
    try {
      await removeTier(tier.id)
    } catch (err) {
      toast.error(String(err))
    } finally {
      setDeletingTierId(null)
    }
  }

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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
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

        <Link
          href={`/dashboard/finance/funds/${id}/leaderboard`}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-300 transition-colors hover:bg-cyan-500/15"
        >
          <Trophy className="h-4 w-4" />
          Leaderboard
        </Link>
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

        {hasSelectedTransactions && (
          <div className="px-4 py-3 border-b border-slate-700/80 bg-slate-900/40 grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)_auto] lg:items-center">
            <Select
              id="fund-bulk-action"
              value={bulkAction}
              onChange={(e) => setBulkAction(e.target.value as CashbookBulkAction | '')}
              options={bulkActionOptions}
              placeholder="Choose action"
            />
            <p className="text-xs text-slate-400 lg:px-2">
              {!bulkAction
                ? 'Choose an action to enable row selection.'
                : hasSelectedTransactions
                  ? `${selectedTransactionIds.length} transaction${selectedTransactionIds.length === 1 ? '' : 's'} selected for ${CASHBOOK_BULK_ACTION_SUCCESS_LABELS[bulkAction].toLowerCase()}.`
                  : `${actionableTransactionIds.length} visible transaction${actionableTransactionIds.length === 1 ? '' : 's'} can be ${CASHBOOK_BULK_ACTION_SUCCESS_LABELS[bulkAction].toLowerCase()}.`}
            </p>
            <Button
              size="sm"
              onClick={handleBulkAction}
              loading={bulkSubmitting}
              disabled={!bulkAction || !hasSelectedTransactions}
            >
              Apply action
            </Button>
          </div>
        )}

        {txnLoading ? (
          <div className="px-4 py-10 flex items-center justify-center gap-2 text-slate-500 text-sm">
            <Loader className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : transactions.length === 0 ? (
          <div className="px-4 py-10 text-center text-slate-500 text-sm">
            No transactions for this fund in the selected period.
          </div>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  {showBulkControls && (
                    <th className="w-12 px-4 py-3">
                      <input
                        ref={(input) => {
                          if (input) {
                            input.indeterminate = hasSelectedTransactions && !allActionableSelected
                          }
                        }}
                        type="checkbox"
                        checked={allActionableSelected}
                        onChange={() => toggleAllActionableTransactions()}
                        aria-label="Select all visible transactions for the chosen action"
                        disabled={!bulkAction || actionableTransactionIds.length === 0}
                        className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                      />
                    </th>
                  )}
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
                {pagedTransactions.map((txn) => {
                  const isIn = isIncomingTransactionEffect(txn)
                  const txnCurrency = ((txn.account as { currency?: string } | null)?.currency ?? txn.currency ?? 'USD') as Currency
                  const isSelected = selectedTransactionIds.includes(txn.id)
                  const isActionableForBulkAction = bulkAction !== '' && actionableTransactionIds.includes(txn.id)
                  return (
                    <tr key={txn.id} className="border-b border-slate-700/50 last:border-0 hover:bg-slate-700/20 transition-colors">
                      {showBulkControls && (
                        <td className="px-4 py-3">
                          {isActionableForBulkAction ? (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleTransactionSelection(txn.id)}
                              aria-label={`Select transaction ${txn.reference_number ?? txn.id}`}
                              className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                            />
                          ) : null}
                        </td>
                      )}
                      <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{formatDate(txn.transaction_date)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={KIND_BADGE[txn.kind]}>{transactionDisplayLabel(txn)}</Badge>
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        {(txn.member_name_snapshot || txn.member?.name || txn.counterparty_record?.name || txn.counterparty) && (
                          <p className="text-slate-200 truncate">
                            {txn.member_name_snapshot ?? txn.member?.name ?? txn.counterparty_record?.name ?? txn.counterparty}
                          </p>
                        )}
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
          <Pagination
            page={txnPage}
            pageCount={txnPageCount}
            pageSize={TXN_PAGE_SIZE}
            totalCount={transactions.length}
            onPageChange={setTxnPage}
          />
          </>
        )}
      </div>

      {/* recognition tiers */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-amber-400" />
            <p className="text-sm font-medium text-slate-300">Recognition Tiers</p>
          </div>
          <div className="flex items-center gap-3">
            {!tiersLoading && (
              <p className="text-xs text-slate-500">{recognitionTiers.length} tier{recognitionTiers.length !== 1 ? 's' : ''}</p>
            )}
            {canDraftTransactions && !showAddTier && (
              <button
                onClick={() => {
                  setShowAddTier(true)
                  setTierCurrency(currencies[0]?.code ?? '')
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-600 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Tier
              </button>
            )}
          </div>
        </div>

        {showAddTier && (
          <form onSubmit={handleAddTier} className="px-4 py-4 border-b border-slate-700 bg-slate-900/40 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Tier Name</label>
                <input
                  type="text"
                  value={tierName}
                  onChange={(e) => setTierName(e.target.value)}
                  placeholder="e.g. Gold"
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Currency</label>
                <select
                  value={tierCurrency}
                  onChange={(e) => setTierCurrency(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
                >
                  {currencies.map((c) => (
                    <option key={c.code} value={c.code}>{c.code}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Min Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={tierMinAmount}
                  onChange={(e) => setTierMinAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Color</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {TIER_COLOR_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      title={opt.label}
                      onClick={() => setTierColor(opt.value)}
                      className={`h-6 w-6 rounded-full border-2 ${opt.className} ${tierColor === opt.value ? 'border-white scale-110' : 'border-transparent'} transition-transform`}
                    />
                  ))}
                </div>
              </div>
            </div>
            {tierError && (
              <p className="text-xs text-rose-400">{tierError}</p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={tierSaving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-500 disabled:opacity-50 transition-colors"
              >
                {tierSaving ? <Loader className="h-3.5 w-3.5 animate-spin" /> : null}
                Save
              </button>
              <button
                type="button"
                onClick={() => { setShowAddTier(false); setTierError(null) }}
                className="inline-flex items-center rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {tiersLoading ? (
          <div className="px-4 py-8 flex items-center justify-center gap-2 text-slate-500 text-sm">
            <Loader className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : recognitionTiers.length === 0 ? (
          <div className="px-4 py-8 text-center text-slate-500 text-sm">
            No recognition tiers configured for this fund.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-4 py-3 text-slate-400 font-medium w-8">Color</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Name</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Currency</th>
                  <th className="text-right px-4 py-3 text-slate-400 font-medium">Min Amount</th>
                  {canDraftTransactions && (
                    <th className="px-4 py-3" />
                  )}
                </tr>
              </thead>
              <tbody>
                {recognitionTiers.map((tier) => (
                  editingTierId === tier.id ? (
                    <tr key={tier.id} className="border-b border-slate-700/50 last:border-0 bg-slate-900/40">
                      <td colSpan={canDraftTransactions ? 5 : 4} className="px-4 py-3">
                        <form onSubmit={handleSaveEditTier} className="space-y-3">
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">Tier Name</label>
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">Currency</label>
                              <select
                                value={editCurrency}
                                onChange={(e) => setEditCurrency(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
                              >
                                {currencies.map((c) => (
                                  <option key={c.code} value={c.code}>{c.code}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">Min Amount</label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={editMinAmount}
                                onChange={(e) => setEditMinAmount(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">Color</label>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {TIER_COLOR_OPTIONS.map((opt) => (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    title={opt.label}
                                    onClick={() => setEditColor(opt.value)}
                                    className={`h-6 w-6 rounded-full border-2 ${opt.className} ${editColor === opt.value ? 'border-white scale-110' : 'border-transparent'} transition-transform`}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                          {editError && <p className="text-xs text-rose-400">{editError}</p>}
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              disabled={editSaving}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-500 disabled:opacity-50 transition-colors"
                            >
                              {editSaving ? <Loader className="h-3.5 w-3.5 animate-spin" /> : null}
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditTier}
                              className="inline-flex items-center rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-600 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  ) : (
                  <tr key={tier.id} className="border-b border-slate-700/50 last:border-0 hover:bg-slate-700/20 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${TIER_COLOR_PILL[tier.color]}`}>
                        {tier.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-200 font-medium">{tier.name}</td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">{tier.currency}</td>
                    <td className="px-4 py-3 text-right text-slate-200 font-mono">
                      {tier.min_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}+
                    </td>
                    {canDraftTransactions && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => startEditTier(tier)}
                            className="inline-flex items-center justify-center rounded p-1.5 text-slate-500 hover:bg-slate-600/50 hover:text-slate-200 transition-colors"
                            aria-label="Edit tier"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTier(tier)}
                            disabled={deletingTierId === tier.id}
                            className="inline-flex items-center justify-center rounded p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 disabled:opacity-50 transition-colors"
                            aria-label="Delete tier"
                          >
                            {deletingTierId === tier.id
                              ? <Loader className="h-3.5 w-3.5 animate-spin" />
                              : <Trash2 className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
