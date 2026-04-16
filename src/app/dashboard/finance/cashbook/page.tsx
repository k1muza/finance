'use client'

import { useState, useEffect, useCallback, type ElementType } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useAccounts } from '@/hooks/useAccounts'
import { useFunds } from '@/hooks/useFunds'
import { useSources } from '@/hooks/useSources'
import { useCashbook } from '@/hooks/useCashbook'
import { useOpeningBalances } from '@/hooks/useOpeningBalances'
import { usePermissions } from '@/hooks/usePermissions'
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
import { cn } from '@/lib/utils/cn'
import { useAppUiStore } from '@/stores/app-ui-store'
import Link from 'next/link'
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
  ExternalLink,
  Send,
  CheckCircle,
  Stamp,
  Trash2,
  Pencil,
  Wallet,
  FilterX,
} from 'lucide-react'
import {
  Account,
  CashbookTransaction,
  CashbookAuditLog,
  CashbookTransactionLine,
  Currency,
  Fund,
  Source,
  SOURCE_TYPE_LABELS,
  TransactionKind,
  TRANSACTION_KIND_LABELS,
  TRANSACTION_STATUS_LABELS,
  INDIVIDUAL_TITLE_LABELS,
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

function sourceLabel(s: Source) {
  const prefix = s.type === 'individual' && s.title !== 'saint'
    ? `${INDIVIDUAL_TITLE_LABELS[s.title]} `
    : ''
  return `${prefix}${s.name} (${SOURCE_TYPE_LABELS[s.type]})`
}

function buildSourceSnapshotPreview(sources: Source[], sourceId: string) {
  if (!sourceId) return null

  const byId = new Map(sources.map((source) => [source.id, source]))
  const source = byId.get(sourceId)
  if (!source) return null

  if (source.type === 'individual') {
    const assembly = source.parent_id ? byId.get(source.parent_id) : null
    const region = assembly?.parent_id ? byId.get(assembly.parent_id) : null

    if (assembly?.type === 'assembly' && region?.type === 'region') {
      return {
        tone: 'info' as const,
        message: `Posting snapshot: ${assembly.name} / ${region.name}`,
      }
    }

    return {
      tone: 'warning' as const,
      message: 'This individual is missing an assembly/region hierarchy. Posting will fail until the source tree is fixed.',
    }
  }

  if (source.type === 'assembly') {
    const region = source.parent_id ? byId.get(source.parent_id) : null

    if (region?.type === 'region') {
      return {
        tone: 'info' as const,
        message: `Posting snapshot: ${source.name} / ${region.name}`,
      }
    }

    return {
      tone: 'warning' as const,
      message: 'This assembly is missing its region parent. Posting will fail until the source tree is fixed.',
    }
  }

  if (source.type === 'region') {
    return {
      tone: 'info' as const,
      message: `Posting snapshot: ${source.name}`,
    }
  }

  return null
}

// ─── new transaction form ─────────────────────────────────────────────────────

interface NewTransactionFormProps {
  accounts: Account[]
  funds: Fund[]
  sources: Source[]
  districtId: string
  defaultAccountId: string
  onSaved: () => void
  onClose: () => void
}

function NewTransactionForm({ accounts, funds, sources, districtId, defaultAccountId, onSaved, onClose }: NewTransactionFormProps) {
  const toast = useToast()
  const supabase = createClient()

  const [form, setForm] = useState({
    account_id: defaultAccountId,
    kind: 'receipt' as TransactionKind,
    transaction_date: toIsoDate(new Date()),
    source_id: '',
    counterparty: '',
    narration: '',
    fund_id: '',
    amount: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedAccount = accounts.find((a) => a.id === form.account_id)
  const selectedFund = funds.find((fund) => fund.id === form.fund_id) ?? null
  const selectedSource = sources.find((source) => source.id === form.source_id) ?? null
  const sourcePreview = buildSourceSnapshotPreview(sources, form.source_id)
  const sourceFieldLabel = form.kind === 'payment' ? 'Payee Source' : 'Source'
  const counterpartyLabel = form.kind === 'payment' ? 'Fallback Payee Name' : 'Fallback Counterparty Name'

  const handleSave = async () => {
    setError(null)
    if (!form.account_id) { setError('Select an account'); return }
    if (!form.transaction_date) { setError('Date is required'); return }
    if ((form.kind === 'receipt' || form.kind === 'payment') && !form.fund_id) {
      setError('Select a fund for receipts and payments')
      return
    }
    if ((form.kind === 'receipt' || form.kind === 'payment') && !form.source_id && !form.counterparty.trim()) {
      setError('Provide either a district source or a fallback counterparty name')
      return
    }
    if (selectedFund?.requires_individual_source && selectedSource?.type !== 'individual') {
      setError('This fund requires an individual source')
      return
    }
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
          source_id: form.source_id || null,
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
        <div className="space-y-1">
          <Select
            label={`${sourceFieldLabel}${selectedFund?.requires_individual_source ? ' *' : ''}`}
            value={form.source_id}
            onChange={(e) => setForm((f) => ({ ...f, source_id: e.target.value }))}
            options={sources.filter((s) => s.is_active).map((s) => ({
              value: s.id,
              label: sourceLabel(s),
            }))}
            placeholder="No source"
          />
          <p className="text-xs text-slate-500">
            {selectedFund?.requires_individual_source
              ? 'This fund can only be posted with an individual source.'
              : form.kind === 'payment'
                ? 'Choose the district source to record as payee when available.'
                : 'Choose the district source to keep reporting tied to the source hierarchy.'}
          </p>
          {sourcePreview && (
            <p className={cn(
              'text-xs',
              sourcePreview.tone === 'warning' ? 'text-amber-300' : 'text-cyan-300',
            )}>
              {sourcePreview.message}
            </p>
          )}
        </div>
        <Input
          label={counterpartyLabel}
          value={form.counterparty}
          onChange={(e) => setForm((f) => ({ ...f, counterparty: e.target.value }))}
          placeholder="Use when the payer or payee is not in district sources"
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
          options={funds.filter((f) => f.is_active).map((f) => ({ value: f.id, label: f.name }))}
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
        <Button onClick={handleSave} loading={saving}>Save draft</Button>
      </div>
    </div>
  )
}

// ─── edit draft form ──────────────────────────────────────────────────────────

interface EditDraftFormProps {
  txn: CashbookTransaction
  accounts: Account[]
  funds: Fund[]
  sources: Source[]
  onSaved: () => void
  onClose: () => void
}

function EditDraftForm({ txn, accounts, funds, sources, onSaved, onClose }: EditDraftFormProps) {
  const toast = useToast()
  const supabase = createClient()

  const [form, setForm] = useState({
    account_id: txn.account_id,
    kind: txn.kind,
    transaction_date: txn.transaction_date,
    source_id: txn.source_id ?? '',
    counterparty: txn.counterparty ?? '',
    narration: txn.narration ?? '',
    fund_id: txn.fund_id ?? '',
    amount: String(txn.total_amount),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedAccount = accounts.find((a) => a.id === form.account_id)
  const selectedFund = funds.find((fund) => fund.id === form.fund_id) ?? null
  const selectedSource = sources.find((source) => source.id === form.source_id) ?? null
  const sourcePreview = buildSourceSnapshotPreview(sources, form.source_id)
  const sourceFieldLabel = form.kind === 'payment' ? 'Payee Source' : 'Source'
  const counterpartyLabel = form.kind === 'payment' ? 'Fallback Payee Name' : 'Fallback Counterparty Name'

  const handleSave = async () => {
    setError(null)
    if ((form.kind === 'receipt' || form.kind === 'payment') && !form.fund_id) {
      setError('Select a fund for receipts and payments')
      return
    }
    if ((form.kind === 'receipt' || form.kind === 'payment') && !form.source_id && !form.counterparty.trim()) {
      setError('Provide either a district source or a fallback counterparty name')
      return
    }
    if (selectedFund?.requires_individual_source && selectedSource?.type !== 'individual') {
      setError('This fund requires an individual source')
      return
    }
    const amount = parseFloat(form.amount)
    if (isNaN(amount) || amount <= 0) { setError('Amount must be greater than 0'); return }

    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const res = await fetch(`/api/cashbook/transactions/${txn.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          account_id: form.account_id,
          fund_id: form.fund_id || null,
          source_id: form.source_id || null,
          kind: form.kind,
          transaction_date: form.transaction_date,
          counterparty: form.counterparty || null,
          narration: form.narration || null,
          currency: selectedAccount?.currency ?? txn.currency,
          total_amount: amount,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to update')
      toast.success('Draft updated')
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
        <div className="space-y-1">
          <Select
            label={`${sourceFieldLabel}${selectedFund?.requires_individual_source ? ' *' : ''}`}
            value={form.source_id}
            onChange={(e) => setForm((f) => ({ ...f, source_id: e.target.value }))}
            options={sources.filter((s) => s.is_active).map((s) => ({
              value: s.id,
              label: sourceLabel(s),
            }))}
            placeholder="No source"
          />
          <p className="text-xs text-slate-500">
            {selectedFund?.requires_individual_source
              ? 'This fund can only be posted with an individual source.'
              : form.kind === 'payment'
                ? 'Choose the district source to record as payee when available.'
                : 'Choose the district source to keep reporting tied to the source hierarchy.'}
          </p>
          {sourcePreview && (
            <p className={cn(
              'text-xs',
              sourcePreview.tone === 'warning' ? 'text-amber-300' : 'text-cyan-300',
            )}>
              {sourcePreview.message}
            </p>
          )}
        </div>
        <Input
          label={counterpartyLabel}
          value={form.counterparty}
          onChange={(e) => setForm((f) => ({ ...f, counterparty: e.target.value }))}
          placeholder="Use when the payer or payee is not in district sources"
        />
        <Input
          label="Narration"
          value={form.narration}
          onChange={(e) => setForm((f) => ({ ...f, narration: e.target.value }))}
          placeholder="Description"
        />
        <Select
          label="Fund"
          value={form.fund_id}
          onChange={(e) => setForm((f) => ({ ...f, fund_id: e.target.value }))}
          options={funds.filter((f) => f.is_active).map((f) => ({ value: f.id, label: f.name }))}
          placeholder="Unassigned"
        />
        <Input
          label={`Amount${selectedAccount ? ` (${selectedAccount.currency})` : ''} *`}
          type="number"
          min="0.01"
          step="0.01"
          value={form.amount}
          onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
        <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={handleSave} loading={saving}>Save changes</Button>
      </div>
    </div>
  )
}

// ─── transaction detail slide-over ────────────────────────────────────────────

interface TransactionDetailProps {
  txnId: string
  userId: string
  onTableRefresh: () => void
  onReverseRequest: (txn: CashbookTransaction) => void
}

function TransactionDetail({ txnId, userId, onTableRefresh, onReverseRequest }: TransactionDetailProps) {
  const supabase = createClient()
  const toast = useToast()
  const { can } = usePermissions()
  const [data, setData] = useState<(CashbookTransaction & { lines: CashbookTransactionLine[]; audit: CashbookAuditLog[] }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const r = await fetch(`/api/cashbook/transactions/${txnId}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      const j = await r.json()
      setData(j.data ?? null)
      if (!r.ok) setError(j.error ?? 'Failed to load')
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [supabase.auth, txnId])

  useEffect(() => { void load() }, [load])

  const doAction = async (action: string) => {
    setActionLoading(action)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const res = await fetch(`/api/cashbook/transactions/${txnId}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `${action} failed`)

      const actionLabels: Record<string, string> = {
        submit: 'submitted', approve: 'approved', post: 'posted', void: 'voided',
      }
      toast.success(`Transaction ${actionLabels[action] ?? action}`)
      await load()
      onTableRefresh()
    } catch (e) {
      toast.error(String(e))
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) return (
    <div className="flex items-center gap-2 text-slate-400 text-sm">
      <Loader className="h-4 w-4 animate-spin" /> Loading...
    </div>
  )
  if (error || !data) return <div className="text-red-400 text-sm">{error ?? 'Not found'}</div>

  const isSelf = data.created_by === userId
  const canSubmit = data.status === 'draft' && can('transactions.draft')
  const canApprove = data.status === 'submitted' && !isSelf && can('transactions.approve')
  const canPost = data.status === 'approved' && can('transactions.post')
  const canVoid = data.status === 'draft' && can('transactions.draft')
  const canReverse = data.status === 'posted' && data.kind !== 'reversal' && !data.source_transaction_id && can('transactions.reverse')

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
          {(data.source || data.source_name_snapshot) && (
            <>
              <dt className="text-slate-400">Source</dt>
              <dd className="text-slate-100">
                {data.source ? sourceLabel(data.source as Source) : data.source_name_snapshot}
              </dd>
            </>
          )}
          {(data.assembly_snapshot as Source | null)?.name && (
            <>
              <dt className="text-slate-400">Assembly Snapshot</dt>
              <dd className="text-slate-100">{(data.assembly_snapshot as Source).name}</dd>
            </>
          )}
          {(data.region_snapshot as Source | null)?.name && (
            <>
              <dt className="text-slate-400">Region Snapshot</dt>
              <dd className="text-slate-100">{(data.region_snapshot as Source).name}</dd>
            </>
          )}
          {!data.assembly_snapshot && data.source_parent_name_snapshot && (
            <>
              <dt className="text-slate-400">Parent Snapshot</dt>
              <dd className="text-slate-100">{data.source_parent_name_snapshot}</dd>
            </>
          )}
          {data.counterparty && <><dt className="text-slate-400">Counterparty</dt><dd className="text-slate-100">{data.counterparty}</dd></>}
          {data.narration && <><dt className="text-slate-400">Narration</dt><dd className="text-slate-100 col-span-1">{data.narration}</dd></>}
          {(data.account as Account)?.name && <><dt className="text-slate-400">Account</dt><dd className="text-slate-100">{(data.account as Account).name}</dd></>}
        </dl>
      </div>

      {/* workflow actions */}
      {(canSubmit || canApprove || canPost || canVoid || canReverse) && (
        <div className="space-y-2 border border-slate-700 rounded-lg p-3">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Actions</p>
          <div className="flex flex-wrap gap-2">
            {canSubmit && (
              <Button
                size="sm"
                onClick={() => doAction('submit')}
                loading={actionLoading === 'submit'}
                disabled={!!actionLoading}
              >
                <Send className="h-3.5 w-3.5" />
                Submit
              </Button>
            )}
            {canApprove && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => doAction('approve')}
                loading={actionLoading === 'approve'}
                disabled={!!actionLoading}
              >
                <CheckCircle className="h-3.5 w-3.5" />
                Approve
              </Button>
            )}
            {data.status === 'submitted' && isSelf && (
              <p className="text-xs text-amber-400/80 self-center">A preparer cannot approve their own transaction.</p>
            )}
            {canPost && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => doAction('post')}
                loading={actionLoading === 'post'}
                disabled={!!actionLoading}
              >
                <Stamp className="h-3.5 w-3.5" />
                Post
              </Button>
            )}
            {canVoid && (
              <Button
                size="sm"
                variant="danger"
                onClick={() => doAction('void')}
                loading={actionLoading === 'void'}
                disabled={!!actionLoading}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Void
              </Button>
            )}
            {canReverse && (
              <Button
                size="sm"
                variant="danger"
                onClick={() => onReverseRequest(data)}
                disabled={!!actionLoading}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reverse
              </Button>
            )}
          </div>
        </div>
      )}

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

interface CashbookMetricCardProps {
  label: string
  value: string
  caption: string
  icon: ElementType
  tone?: 'default' | 'positive' | 'negative' | 'accent'
}

function CashbookMetricCard({
  label,
  value,
  caption,
  icon: Icon,
  tone = 'default',
}: CashbookMetricCardProps) {
  const tones = {
    default: {
      panel: 'border-slate-700 bg-slate-800/80',
      icon: 'bg-slate-700/70 text-slate-300',
      value: 'text-slate-100',
      caption: 'text-slate-500',
    },
    positive: {
      panel: 'border-emerald-500/20 bg-emerald-500/5',
      icon: 'bg-emerald-500/10 text-emerald-400',
      value: 'text-emerald-400',
      caption: 'text-emerald-200/70',
    },
    negative: {
      panel: 'border-red-500/20 bg-red-500/5',
      icon: 'bg-red-500/10 text-red-400',
      value: 'text-red-400',
      caption: 'text-red-200/70',
    },
    accent: {
      panel: 'border-cyan-500/30 bg-cyan-500/10',
      icon: 'bg-cyan-500/10 text-cyan-400',
      value: 'text-cyan-300',
      caption: 'text-cyan-100/70',
    },
  } as const

  const palette = tones[tone]

  return (
    <div className={cn('rounded-xl border p-4', palette.panel)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{label}</p>
          <p className={cn('text-2xl font-semibold tracking-tight', palette.value)}>{value}</p>
          <p className={cn('text-xs', palette.caption)}>{caption}</p>
        </div>
        <div className={cn('rounded-xl p-2 shrink-0', palette.icon)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  )
}

export default function CashbookPage() {
  const { districtId, user } = useAuth()
  const { can } = usePermissions()
  const toast = useToast()
  const defaultDateFrom = firstOfMonth()
  const defaultDateTo = toIsoDate(new Date())

  const selectedAccountId = useAppUiStore((state) =>
    districtId ? (state.cashbookActiveAccountIds[districtId] ?? '') : '',
  )
  const cashbookFilterDraft = useAppUiStore((state) =>
    districtId ? state.cashbookFilterDraftsByDistrict[districtId] : undefined,
  )
  const hasHydratedAppUiState = useAppUiStore((state) => state.hasHydrated)
  const setCashbookActiveAccountId = useAppUiStore((state) => state.setCashbookActiveAccountId)
  const setCashbookFilterDraft = useAppUiStore((state) => state.setCashbookFilterDraft)
  const clearCashbookFilterDraft = useAppUiStore((state) => state.clearCashbookFilterDraft)
  const dateFrom = cashbookFilterDraft?.dateFrom ?? defaultDateFrom
  const dateTo = cashbookFilterDraft?.dateTo ?? defaultDateTo
  const kindFilter = cashbookFilterDraft?.kindFilter ?? ''
  const search = cashbookFilterDraft?.search ?? ''

  const [newTxnOpen, setNewTxnOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState<CashbookTransaction | null>(null)

  const [reverseTarget, setReverseTarget] = useState<CashbookTransaction | null>(null)
  const [reverseNarration, setReverseNarration] = useState('')
  const [reverseLoading, setReverseLoading] = useState(false)

  const selectedFundId = cashbookFilterDraft?.selectedFundId ?? null

  const { data: accounts, loading: accountsLoading } = useAccounts({ district_id: districtId })
  const { data: funds } = useFunds({ district_id: districtId })
  const { data: sources } = useSources({ district_id: districtId })
  const { data: openingBalances } = useOpeningBalances({ account_id: selectedAccountId || null, district_id: districtId })

  const { data: transactions, loading: txnLoading, reverse, refresh } = useCashbook({
    district_id: districtId,
    account_id: selectedAccountId || null,
    kind: kindFilter || null,
    date_from: dateFrom,
    date_to: dateTo,
  })

  const setSelectedAccountId = useCallback((accountId: string | null) => {
    if (!districtId) return
    setCashbookActiveAccountId(districtId, accountId)
  }, [districtId, setCashbookActiveAccountId])

  const updateCashbookFilterDraft = useCallback((patch: {
    dateFrom?: string | null
    dateTo?: string | null
    kindFilter?: TransactionKind | ''
    search?: string
    selectedFundId?: string | null
  }) => {
    if (!districtId) return
    setCashbookFilterDraft(districtId, patch)
  }, [districtId, setCashbookFilterDraft])

  // Restore or auto-select a valid account for the current district.
  useEffect(() => {
    if (!districtId || !hasHydratedAppUiState || accountsLoading) return

    if (accounts.length === 0) {
      setCashbookActiveAccountId(districtId, null)
      return
    }

    if (selectedAccountId && accounts.some((account) => account.id === selectedAccountId)) {
      return
    }

    const first = accounts.find((account) => account.status === 'active') ?? accounts[0]
    setCashbookActiveAccountId(districtId, first.id)
  }, [
    accounts,
    accountsLoading,
    districtId,
    hasHydratedAppUiState,
    selectedAccountId,
    setCashbookActiveAccountId,
  ])

  // ── balance calculations ──────────────────────────────────────────────────
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId)
  const selectedFund = funds.find((fund) => fund.id === selectedFundId) ?? null
  const canDraftTransactions = can('transactions.draft')
  const canReverseTransactions = can('transactions.reverse')

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
    if (selectedFundId && t.fund_id !== selectedFundId) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      t.narration?.toLowerCase().includes(q) ||
      t.counterparty?.toLowerCase().includes(q) ||
      t.source_name_snapshot?.toLowerCase().includes(q) ||
      t.reference_number?.toLowerCase().includes(q)
    )
  })

  const hasTableFilters = Boolean(search || selectedFundId)
  const hasCustomFilters = Boolean(
    kindFilter ||
    selectedFundId ||
    search ||
    dateFrom !== defaultDateFrom ||
    dateTo !== defaultDateTo
  )
  const resultLabel = filtered.length === transactions.length
    ? `${filtered.length} transaction${filtered.length === 1 ? '' : 's'}`
    : `${filtered.length} of ${transactions.length} transactions`

  const resetFilters = () => {
    if (!districtId) return
    clearCashbookFilterDraft(districtId)
  }

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
    <div className="max-w-7xl mx-auto space-y-5 p-4 md:p-6">
      {/* page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-cyan-400" />
            Cashbook
          </h1>
          <p className="text-sm text-slate-400 mt-1">Daily transaction register — draft, submit, approve, and post.</p>
        </div>
        <Button onClick={() => setNewTxnOpen(true)} disabled={!selectedAccountId || !canDraftTransactions}>
          <PlusCircle className="h-4 w-4" />
          New transaction
        </Button>
      </div>

      {/* two-column layout */}
      <div className="space-y-5">

        {/* ── left sidebar: funds ── */}
        <section className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/70 shadow-[0_24px_60px_-40px_rgba(2,6,23,0.9)]">
          <div className="space-y-5 p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Workspace</span>
                  {selectedAccount && (
                    <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                      {selectedAccount.currency}
                    </span>
                  )}
                  {selectedAccount?.status === 'archived' && (
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300">
                      Archived account
                    </span>
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-100">
                    {selectedAccount ? selectedAccount.name : 'Choose an account to begin'}
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Keep the working filters together here, then use fund chips and search below to narrow the register.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-slate-400">
                  <span className="block uppercase tracking-wide text-slate-500">Period</span>
                  <span className="mt-1 block text-slate-200">
                    {formatDate(dateFrom)} - {formatDate(dateTo)}
                  </span>
                </div>
                {hasCustomFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetFilters}
                    className="h-10 border border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-600"
                  >
                    <FilterX className="h-4 w-4" />
                    Reset filters
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-slate-700/80 bg-slate-950/25 px-5 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
                  <Wallet className="h-4 w-4 text-cyan-400" />
                  Fund filter
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Narrow the visible register rows by fund without changing the account totals above.
                </p>
              </div>

              {selectedFund && (
                <Link
                  href={`/dashboard/finance/funds/${selectedFund.id}`}
                  className="inline-flex items-center gap-2 text-sm text-cyan-400 transition-colors hover:text-cyan-300"
                >
                  Open selected fund
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>

            {funds.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => updateCashbookFilterDraft({ selectedFundId: null })}
                  className={cn(
                    'inline-flex items-center rounded-xl border px-3 py-2 text-sm transition-colors',
                    selectedFundId === null
                      ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
                      : 'border-slate-700 bg-slate-800/70 text-slate-300 hover:border-slate-600 hover:bg-slate-800 hover:text-slate-100'
                  )}
                >
                  All funds
                </button>

                {funds.map((fund) => {
                  const isActive = selectedFundId === fund.id

                  return (
                    <button
                      key={fund.id}
                      type="button"
                      onClick={() => updateCashbookFilterDraft({
                        selectedFundId: fund.id === selectedFundId ? null : fund.id,
                      })}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors',
                        isActive
                          ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
                          : 'border-slate-700 bg-slate-800/70 text-slate-300 hover:border-slate-600 hover:bg-slate-800 hover:text-slate-100'
                      )}
                    >
                      <span>{fund.name}</span>
                      {fund.is_restricted && (
                        <span
                          className={cn(
                            'rounded-full px-1.5 py-0.5 text-[10px] uppercase tracking-wide',
                            isActive ? 'bg-amber-500/10 text-amber-300' : 'bg-slate-700 text-amber-400'
                          )}
                        >
                          Restricted
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="mt-4 text-sm italic text-slate-500">No funds defined yet.</p>
            )}
          </div>
        </section>

        {/* ── main content ── */}
        <div className="space-y-5">

      {/* filters bar */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Select
          label="Account"
          value={selectedAccountId}
          onChange={(e) => setSelectedAccountId(e.target.value)}
          options={accounts.map((a) => ({
            value: a.id,
            label: `${a.name}${a.status === 'archived' ? ' (Archived)' : ''}`,
          }))}
          placeholder={accountsLoading ? 'Loading...' : 'Select account'}
          disabled={accountsLoading || accounts.length === 0}
        />
        <Input
          label="From"
          type="date"
          value={dateFrom}
          onChange={(e) => updateCashbookFilterDraft({ dateFrom: e.target.value })}
        />
        <Input
          label="To"
          type="date"
          value={dateTo}
          onChange={(e) => updateCashbookFilterDraft({ dateTo: e.target.value })}
        />
        <Select
          label="Kind"
          value={kindFilter}
          onChange={(e) => updateCashbookFilterDraft({ kindFilter: e.target.value as TransactionKind | '' })}
          options={Object.entries(TRANSACTION_KIND_LABELS).map(([value, label]) => ({ value, label }))}
          placeholder="All kinds"
        />
      </div>

      {/* balance summary */}
      {selectedAccount && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <CashbookMetricCard
            label="Opening"
            value={formatCurrency(openingBalance, currency)}
            caption={`Before ${formatDate(dateFrom)}`}
            icon={BookOpen}
          />
          <CashbookMetricCard
            label="Total In"
            value={formatCurrency(totalIn, currency)}
            caption="Posted inflows in range"
            icon={ArrowDownCircle}
            tone="positive"
          />
          <CashbookMetricCard
            label="Total Out"
            value={formatCurrency(totalOut, currency)}
            caption="Posted outflows in range"
            icon={ArrowUpCircle}
            tone="negative"
          />
          <CashbookMetricCard
            label="Closing"
            value={formatCurrency(closingBalance, currency)}
            caption="Opening plus net movement"
            icon={Scale}
            tone="accent"
          />
        </div>
      )}

      {/* search + table */}
      <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800">
        <div className="border-b border-slate-700 px-4 py-4 md:px-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Transactions</h3>
              <p className="mt-1 text-xs text-slate-500">
                {selectedFund ? `Filtered to ${selectedFund.name}` : 'All funds visible'} - {resultLabel}
              </p>
            </div>

            <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end xl:w-auto">
              <p className="text-xs text-slate-500 sm:text-right">
                {selectedAccount ? `${selectedAccount.name} - ${currency}` : 'Choose an account to load entries'}
              </p>
              <div className="flex w-full items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 sm:w-[340px]">
                <Search className="h-4 w-4 shrink-0 text-slate-500" />
                <input
                  className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
                  placeholder="Search narration, counterparty, reference..."
                  value={search}
                  onChange={(e) => updateCashbookFilterDraft({ search: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>

        {txnLoading ? (
          <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-slate-500">
            <Loader className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-slate-500">
            {hasTableFilters
              ? 'No transactions match the current fund or search filter.'
              : 'No transactions found for the selected account and date range.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="px-4 py-3 text-left font-medium text-slate-400">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-400">Ref</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-400">Kind</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-400">Counterparty / Narration</th>
                  <th className="px-4 py-3 text-right font-medium text-emerald-400/80">In</th>
                  <th className="px-4 py-3 text-right font-medium text-red-400/80">Out</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-400">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((txn) => {
                  const isIn = KIND_DIRECTION[txn.kind] === 'in'
                  const isOut = KIND_DIRECTION[txn.kind] === 'out'
                  return (
                    <tr key={txn.id} className="border-b border-slate-700/50 transition-colors last:border-0 hover:bg-slate-700/20">
                      <td className="whitespace-nowrap px-4 py-3.5 text-slate-300">{formatDate(txn.transaction_date)}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 font-mono text-xs text-slate-500">
                        {txn.reference_number ?? <span className="text-slate-700">—</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge variant={txn.kind === 'receipt' ? 'green' : txn.kind === 'payment' ? 'red' : txn.kind === 'reversal' ? 'yellow' : 'default'}>
                          {TRANSACTION_KIND_LABELS[txn.kind]}
                        </Badge>
                      </td>
                      <td className="max-w-[280px] px-4 py-3.5">
                        {(txn.source_name_snapshot || txn.counterparty) && (
                          <p className="truncate text-slate-200">{txn.source_name_snapshot ?? txn.counterparty}</p>
                        )}
                        {txn.narration && <p className="truncate text-xs text-slate-500">{txn.narration}</p>}
                        {!txn.source_name_snapshot && !txn.counterparty && !txn.narration && <span className="text-slate-700">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono">
                        {isIn ? <span className="text-emerald-400">{formatCurrency(txn.total_amount, currency)}</span> : <span className="text-slate-700">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono">
                        {isOut ? <span className="text-red-400">{formatCurrency(txn.total_amount, currency)}</span> : <span className="text-slate-700">—</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge variant={STATUS_BADGE_VARIANT[txn.status]}>{TRANSACTION_STATUS_LABELS[txn.status]}</Badge>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                          {txn.status === 'draft' && canDraftTransactions && (
                            <Button size="sm" variant="ghost" onClick={() => setEditTarget(txn)} title="Edit draft" className="text-slate-400">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {txn.status === 'posted' && canReverseTransactions && txn.kind !== 'reversal' && !txn.source_transaction_id && (
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

        </div>
      </div>

      {/* new transaction slide-over */}
      <SlideOver open={newTxnOpen} onClose={() => setNewTxnOpen(false)} title="New Transaction">
        <NewTransactionForm
          accounts={accounts}
          funds={funds}
          sources={sources}
          districtId={districtId}
          defaultAccountId={selectedAccountId}
          onSaved={() => { setNewTxnOpen(false); void refresh() }}
          onClose={() => setNewTxnOpen(false)}
        />
      </SlideOver>

      {/* edit draft slide-over */}
      <SlideOver open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Draft">
        {editTarget && (
          <EditDraftForm
            txn={editTarget}
            accounts={accounts}
            funds={funds}
            sources={sources}
            onSaved={() => { setEditTarget(null); void refresh() }}
            onClose={() => setEditTarget(null)}
          />
        )}
      </SlideOver>

      {/* transaction detail slide-over */}
      <SlideOver
        open={!!detailId}
        onClose={() => setDetailId(null)}
        title="Transaction Detail"
      >
        {detailId && (
          <TransactionDetail
            txnId={detailId}
            userId={user?.id ?? ''}
            onTableRefresh={refresh}
            onReverseRequest={(txn) => {
              setReverseTarget(txn)
              setReverseNarration('')
            }}
          />
        )}
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
