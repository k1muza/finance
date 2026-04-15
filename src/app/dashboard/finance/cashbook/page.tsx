'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useAccounts } from '@/hooks/useAccounts'
import { useFunds } from '@/hooks/useFunds'
import { useCashbook } from '@/hooks/useCashbook'
import { useOpeningBalances } from '@/hooks/useOpeningBalances'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { SlideOver } from '@/components/ui/SlideOver'
import { Modal } from '@/components/ui/Modal'
import { SelectDistrictHint } from '@/components/layout/SelectDistrictHint'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { createClient } from '@/lib/supabase/client'
import {
  PlusCircle,
  Search,
  ArrowUpCircle,
  ArrowDownCircle,
  Scale,
  RotateCcw,
  ChevronRight,
  BookOpen,
  AlertCircle,
  Loader,
} from 'lucide-react'
import {
  Account,
  CashbookTransaction,
  CashbookAuditLog,
  CashbookTransactionLine,
  Currency,
  TransactionKind,
  TRANSACTION_KIND_LABELS,
  TRANSACTION_STATUS_LABELS,
} from '@/types'

// ─── helpers ──────────────────────────────────────────────────────────────────

const toIsoDate = (d: Date) => d.toISOString().split('T')[0]

const firstOfMonth = () => {
  const d = new Date()
  d.setDate(1)
  return toIsoDate(d)
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

const KIND_DIRECTION: Record<TransactionKind, 'in' | 'out' | 'neutral'> = {
  receipt: 'in',
  opening_balance: 'in',
  adjustment: 'in',
  payment: 'out',
  transfer: 'out',
  reversal: 'out',
}

const STATUS_BADGE_VARIANT: Record<string, 'default' | 'green' | 'yellow' | 'teal' | 'red'> = {
  draft: 'default',
  submitted: 'yellow',
  approved: 'teal',
  posted: 'green',
  reversed: 'red',
  voided: 'red',
}

// ─── sub-components ───────────────────────────────────────────────────────────

interface NewTransactionFormProps {
  accounts: Account[]
  districtId: string
  defaultAccountId: string
  onSaved: () => void
  onClose: () => void
}

function NewTransactionForm({ accounts, districtId, defaultAccountId, onSaved, onClose }: NewTransactionFormProps) {
  const toast = useToast()
  const { data: funds } = useFunds({ district_id: districtId })
  const supabase = createClient()

  const [form, setForm] = useState({
    account_id: defaultAccountId,
    kind: 'receipt' as TransactionKind,
    transaction_date: toIsoDate(new Date()),
    counterparty: '',
    narration: '',
    fund_id: '',
    amount: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedAccount = accounts.find((a) => a.id === form.account_id)

  const handleSave = async () => {
    setError(null)
    if (!form.account_id) { setError('Select an account'); return }
    if (!form.transaction_date) { setError('Date is required'); return }
    const amount = parseFloat(form.amount)
    if (isNaN(amount) || amount <= 0) { setError('Amount must be greater than 0'); return }

    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const res = await fetch('/api/cashbook/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          district_id: districtId,
          account_id: form.account_id,
          fund_id: form.fund_id || null,
          kind: form.kind,
          transaction_date: form.transaction_date,
          counterparty: form.counterparty || null,
          narration: form.narration || null,
          currency: selectedAccount?.currency ?? 'USD',
          total_amount: amount,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to save')
      toast.success('Transaction saved as draft')
      onSaved()
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4">
        <Select
          label="Account *"
          value={form.account_id}
          onChange={(e) => setForm((f) => ({ ...f, account_id: e.target.value }))}
          options={accounts.filter((a) => a.status === 'active').map((a) => ({
            value: a.id,
            label: `${a.name} (${a.currency})`,
          }))}
          placeholder="Select account"
        />
        <Select
          label="Kind *"
          value={form.kind}
          onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as TransactionKind }))}
          options={(['receipt', 'payment', 'transfer', 'adjustment'] as TransactionKind[]).map((k) => ({
            value: k,
            label: TRANSACTION_KIND_LABELS[k],
          }))}
        />
        <Input
          label="Date *"
          type="date"
          value={form.transaction_date}
          onChange={(e) => setForm((f) => ({ ...f, transaction_date: e.target.value }))}
        />
        <Input
          label="Counterparty"
          value={form.counterparty}
          onChange={(e) => setForm((f) => ({ ...f, counterparty: e.target.value }))}
          placeholder="Payer or payee name"
        />
        <Input
          label="Narration"
          value={form.narration}
          onChange={(e) => setForm((f) => ({ ...f, narration: e.target.value }))}
          placeholder="Description of the transaction"
        />
        <Select
          label="Fund"
          value={form.fund_id}
          onChange={(e) => setForm((f) => ({ ...f, fund_id: e.target.value }))}
          options={funds.map((f) => ({ value: f.id, label: f.name }))}
          placeholder="Unassigned"
        />
        <div>
          <Input
            label={`Amount${selectedAccount ? ` (${selectedAccount.currency})` : ''} *`}
            type="number"
            min="0.01"
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            placeholder="0.00"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
        <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={handleSave} loading={saving}>Save</Button>
      </div>
    </div>
  )
}

// ─── transaction detail slide-over ────────────────────────────────────────────

interface TransactionDetailProps {
  txnId: string
}

function TransactionDetail({ txnId }: TransactionDetailProps) {
  const [data, setData] = useState<(CashbookTransaction & { lines: CashbookTransactionLine[]; audit: CashbookAuditLog[] }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const r = await fetch(`/api/cashbook/transactions/${txnId}`)
        const j = await r.json()
        if (!cancelled) {
          setData(j.data ?? null)
          setError(j.error ?? null)
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled) { setError(String(e)); setLoading(false) }
      }
    }
    void load()
    return () => { cancelled = true }
  }, [txnId])

  if (loading) return <div className="flex items-center gap-2 text-slate-400 text-sm"><Loader className="h-4 w-4 animate-spin" /> Loading...</div>
  if (error || !data) return <div className="text-red-400 text-sm">{error ?? 'Not found'}</div>

  return (
    <div className="space-y-6 text-sm">
      {/* header info */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Badge variant={STATUS_BADGE_VARIANT[data.status]}>{TRANSACTION_STATUS_LABELS[data.status]}</Badge>
          {data.reference_number && <span className="font-mono text-slate-400 text-xs">{data.reference_number}</span>}
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          <dt className="text-slate-400">Kind</dt><dd className="text-slate-100">{TRANSACTION_KIND_LABELS[data.kind]}</dd>
          <dt className="text-slate-400">Date</dt><dd className="text-slate-100">{formatDate(data.transaction_date)}</dd>
          <dt className="text-slate-400">Amount</dt><dd className="text-slate-100 font-medium">{formatCurrency(data.total_amount, data.currency)}</dd>
          {data.counterparty && <><dt className="text-slate-400">Counterparty</dt><dd className="text-slate-100">{data.counterparty}</dd></>}
          {data.narration && <><dt className="text-slate-400">Narration</dt><dd className="text-slate-100 col-span-1">{data.narration}</dd></>}
          {(data.account as Account)?.name && <><dt className="text-slate-400">Account</dt><dd className="text-slate-100">{(data.account as Account).name}</dd></>}
        </dl>
      </div>

      {/* transaction lines */}
      {data.lines.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Lines</p>
          <table className="w-full text-xs">
            <thead><tr className="border-b border-slate-700">
              <th className="text-left py-1 text-slate-400">Direction</th>
              <th className="text-left py-1 text-slate-400">Category</th>
              <th className="text-right py-1 text-slate-400">Amount</th>
            </tr></thead>
            <tbody>
              {data.lines.map((l) => (
                <tr key={l.id} className="border-b border-slate-700/40 last:border-0">
                  <td className="py-1"><Badge variant={l.direction === 'credit' ? 'green' : 'red'}>{l.direction}</Badge></td>
                  <td className="py-1 text-slate-300">{l.category ?? '—'}</td>
                  <td className="py-1 text-right font-mono text-slate-200">{formatCurrency(l.amount, data.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* audit timeline */}
      {data.audit.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">History</p>
          <ol className="relative border-l border-slate-700 space-y-4 ml-2">
            {data.audit.map((entry) => (
              <li key={entry.id} className="ml-4">
                <span className="absolute -left-1.5 mt-0.5 h-3 w-3 rounded-full bg-slate-600 border border-slate-500" />
                <p className="text-slate-200 capitalize">{entry.action}</p>
                {entry.old_status && entry.new_status && (
                  <p className="text-slate-500 text-xs">{TRANSACTION_STATUS_LABELS[entry.old_status]} → {TRANSACTION_STATUS_LABELS[entry.new_status]}</p>
                )}
                <p className="text-slate-500 text-xs">{new Date(entry.created_at).toLocaleString('en-GB')}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function CashbookPage() {
  const { districtId } = useAuth()
  const toast = useToast()

  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [dateFrom, setDateFrom] = useState(firstOfMonth())
  const [dateTo, setDateTo] = useState(toIsoDate(new Date()))
  const [kindFilter, setKindFilter] = useState<TransactionKind | ''>('')
  const [search, setSearch] = useState('')

  const [newTxnOpen, setNewTxnOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)

  const [reverseTarget, setReverseTarget] = useState<CashbookTransaction | null>(null)
  const [reverseNarration, setReverseNarration] = useState('')
  const [reverseLoading, setReverseLoading] = useState(false)

  const { data: accounts, loading: accountsLoading } = useAccounts({ district_id: districtId })
  const { data: openingBalances } = useOpeningBalances({ account_id: selectedAccountId || null, district_id: districtId })

  const { data: transactions, loading: txnLoading, reverse, refresh } = useCashbook({
    district_id: districtId,
    account_id: selectedAccountId || null,
    kind: kindFilter || null,
    date_from: dateFrom,
    date_to: dateTo,
  })

  // Auto-select first active account
  useEffect(() => {
    if (!selectedAccountId && accounts.length > 0) {
      const first = accounts.find((a) => a.status === 'active') ?? accounts[0]
      setSelectedAccountId(first.id)
    }
  }, [accounts, selectedAccountId])

  // ── balance calculations ──────────────────────────────────────────────────
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId)

  const openingBalance = (() => {
    if (!openingBalances.length) return 0
    const sorted = [...openingBalances]
      .filter((b) => b.effective_date <= dateFrom)
      .sort((a, b) => b.effective_date.localeCompare(a.effective_date))
    return sorted[0]?.amount ?? 0
  })()

  const posted = transactions.filter((t) => t.status === 'posted')
  const totalIn = posted.filter((t) => KIND_DIRECTION[t.kind] === 'in').reduce((s, t) => s + t.total_amount, 0)
  const totalOut = posted.filter((t) => KIND_DIRECTION[t.kind] === 'out').reduce((s, t) => s + t.total_amount, 0)
  const closingBalance = openingBalance + totalIn - totalOut

  // ── filtered display list ─────────────────────────────────────────────────
  const filtered = transactions.filter((t) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      t.narration?.toLowerCase().includes(q) ||
      t.counterparty?.toLowerCase().includes(q) ||
      t.reference_number?.toLowerCase().includes(q)
    )
  })

  const handleReverse = async () => {
    if (!reverseTarget) return
    setReverseLoading(true)
    try {
      await reverse(reverseTarget.id, reverseNarration || undefined)
      toast.success('Transaction reversed')
      setReverseTarget(null)
      setReverseNarration('')
    } catch (e) {
      toast.error(String(e))
    } finally {
      setReverseLoading(false)
    }
  }

  // ── currency ──────────────────────────────────────────────────────────────
  const currency = (selectedAccount?.currency ?? 'USD') as Currency

  if (!districtId) return (
    <div className="p-6 max-w-6xl mx-auto">
      <SelectDistrictHint description="Choose a district to view its cashbook." />
    </div>
  )

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-cyan-400" />
            Cashbook
          </h1>
          <p className="text-sm text-slate-400 mt-1">Daily transaction register — draft, submit, approve, and post.</p>
        </div>
        <Button onClick={() => setNewTxnOpen(true)} disabled={!selectedAccountId}>
          <PlusCircle className="h-4 w-4" />
          New transaction
        </Button>
      </div>

      {/* filters bar */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="min-w-[200px]">
          <Select
            label="Account"
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            options={accounts.map((a) => ({ value: a.id, label: `${a.name}${a.status === 'archived' ? ' (Archived)' : ''}` }))}
            placeholder={accountsLoading ? 'Loading...' : 'Select account'}
            disabled={accountsLoading || accounts.length === 0}
          />
        </div>
        <div className="min-w-[140px]">
          <Input label="From" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="min-w-[140px]">
          <Input label="To" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <div className="min-w-[140px]">
          <Select
            label="Kind"
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as TransactionKind | '')}
            options={Object.entries(TRANSACTION_KIND_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            placeholder="All kinds"
          />
        </div>
      </div>

      {/* balance summary */}
      {selectedAccount && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <p className="text-xs text-slate-400 mb-1">Opening Balance</p>
            <p className="text-lg font-bold text-slate-100">{formatCurrency(openingBalance, currency)}</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <p className="text-xs text-slate-400 mb-1 flex items-center gap-1"><ArrowDownCircle className="h-3.5 w-3.5 text-emerald-400" /> Total In</p>
            <p className="text-lg font-bold text-emerald-400">{formatCurrency(totalIn, currency)}</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <p className="text-xs text-slate-400 mb-1 flex items-center gap-1"><ArrowUpCircle className="h-3.5 w-3.5 text-red-400" /> Total Out</p>
            <p className="text-lg font-bold text-red-400">{formatCurrency(totalOut, currency)}</p>
          </div>
          <div className={`rounded-xl p-4 border ${closingBalance >= 0 ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
            <p className="text-xs text-slate-400 mb-1 flex items-center gap-1"><Scale className="h-3.5 w-3.5 text-cyan-400" /> Closing Balance</p>
            <p className={`text-lg font-bold ${closingBalance >= 0 ? 'text-cyan-300' : 'text-red-400'}`}>{formatCurrency(closingBalance, currency)}</p>
          </div>
        </div>
      )}

      {/* search + table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 flex-1 max-w-sm">
            <Search className="h-4 w-4 text-slate-500 shrink-0" />
            <input
              className="bg-transparent text-sm text-slate-100 placeholder:text-slate-500 outline-none w-full"
              placeholder="Search narration, counterparty, reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <p className="text-xs text-slate-500 ml-auto">{filtered.length} transaction{filtered.length !== 1 ? 's' : ''}</p>
        </div>

        {txnLoading ? (
          <div className="px-4 py-10 flex items-center justify-center gap-2 text-slate-500 text-sm">
            <Loader className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-10 text-center text-slate-500 text-sm">
            No transactions found for the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Date</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Ref</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Kind</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Counterparty / Narration</th>
                  <th className="text-right px-4 py-3 text-slate-400 font-medium text-emerald-400/80">In</th>
                  <th className="text-right px-4 py-3 text-slate-400 font-medium text-red-400/80">Out</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((txn) => {
                  const isIn = KIND_DIRECTION[txn.kind] === 'in'
                  const isOut = KIND_DIRECTION[txn.kind] === 'out'
                  return (
                    <tr key={txn.id} className="border-b border-slate-700/50 last:border-0 hover:bg-slate-700/20 transition-colors">
                      <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{formatDate(txn.transaction_date)}</td>
                      <td className="px-4 py-3 font-mono text-slate-500 text-xs whitespace-nowrap">
                        {txn.reference_number ?? <span className="text-slate-700">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={txn.kind === 'receipt' ? 'green' : txn.kind === 'payment' ? 'red' : txn.kind === 'reversal' ? 'yellow' : 'default'}>
                          {TRANSACTION_KIND_LABELS[txn.kind]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 max-w-[220px]">
                        {txn.counterparty && <p className="text-slate-200 truncate">{txn.counterparty}</p>}
                        {txn.narration && <p className="text-slate-500 text-xs truncate">{txn.narration}</p>}
                        {!txn.counterparty && !txn.narration && <span className="text-slate-700">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {isIn ? <span className="text-emerald-400">{formatCurrency(txn.total_amount, currency)}</span> : <span className="text-slate-700">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {isOut ? <span className="text-red-400">{formatCurrency(txn.total_amount, currency)}</span> : <span className="text-slate-700">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_BADGE_VARIANT[txn.status]}>{TRANSACTION_STATUS_LABELS[txn.status]}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                          {txn.status === 'posted' && (
                            <Button size="sm" variant="ghost" onClick={() => { setReverseTarget(txn); setReverseNarration('') }} className="text-amber-400 hover:text-amber-300" title="Reverse">
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => setDetailId(txn.id)} title="View detail" className="text-slate-400">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* new transaction slide-over */}
      <SlideOver open={newTxnOpen} onClose={() => setNewTxnOpen(false)} title="New Transaction">
        <NewTransactionForm
          accounts={accounts}
          districtId={districtId}
          defaultAccountId={selectedAccountId}
          onSaved={() => { setNewTxnOpen(false); void refresh() }}
          onClose={() => setNewTxnOpen(false)}
        />
      </SlideOver>

      {/* transaction detail slide-over */}
      <SlideOver
        open={!!detailId}
        onClose={() => setDetailId(null)}
        title="Transaction Detail"
      >
        {detailId && <TransactionDetail txnId={detailId} />}
      </SlideOver>

      {/* reversal modal */}
      <Modal open={!!reverseTarget} onClose={() => setReverseTarget(null)} title="Reverse Transaction" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            This will create a reversal transaction and mark the original as reversed. This cannot be undone.
          </p>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Reason (optional)</label>
            <input
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-500"
              placeholder="e.g. Incorrect amount posted"
              value={reverseNarration}
              onChange={(e) => setReverseNarration(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setReverseTarget(null)} disabled={reverseLoading}>Cancel</Button>
            <Button variant="danger" onClick={handleReverse} loading={reverseLoading}>Reverse</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
