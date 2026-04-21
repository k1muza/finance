'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRightLeft, ChevronRight, Loader, RotateCcw, Search, Send, Trash2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useAccounts } from '@/hooks/useAccounts'
import { usePermissions } from '@/hooks/usePermissions'
import { useTransfers } from '@/hooks/useTransfers'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { SlideOver } from '@/components/ui/SlideOver'
import { Modal } from '@/components/ui/Modal'
import { SelectDistrictHint } from '@/components/layout/SelectDistrictHint'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageSpinner } from '@/components/ui/Spinner'
import { Card, CardContent } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { transactionDisplayLabel } from '@/lib/finance/transactions'
import { createClient } from '@/lib/supabase/client'
import type {
  Account,
  CashbookTransaction,
  Currency,
  Transfer,
  TransferStatus,
} from '@/types'
import { TRANSFER_STATUS_LABELS } from '@/types'

type TransferDetailRecord = Transfer & {
  effect_transactions: CashbookTransaction[]
}

const STATUS_BADGE_VARIANT: Record<TransferStatus, 'default' | 'green' | 'yellow' | 'red'> = {
  draft: 'default',
  posted: 'green',
  reversed: 'red',
  voided: 'yellow',
}

const STATUS_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'draft', label: 'Draft' },
  { value: 'posted', label: 'Posted' },
  { value: 'reversed', label: 'Reversed' },
  { value: 'voided', label: 'Voided' },
]

function toIsoDate(date: Date) {
  return date.toISOString().split('T')[0]
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function resolveTransferCurrency(transfer: Transfer, accountMap: Map<string, Account>) {
  return (accountMap.get(transfer.from_account_id)?.currency
    ?? accountMap.get(transfer.to_account_id)?.currency
    ?? 'USD') as Currency
}

function transferRouteLabel(transfer: Transfer, accountMap: Map<string, Account>) {
  const from = accountMap.get(transfer.from_account_id)?.name ?? 'Unknown source'
  const to = accountMap.get(transfer.to_account_id)?.name ?? 'Unknown destination'
  return { from, to, label: `${from} -> ${to}` }
}

function TransferMetricCard({
  label,
  value,
  caption,
}: {
  label: string
  value: string
  caption: string
}) {
  return (
    <Card>
      <CardContent className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{label}</p>
        <p className="text-2xl font-semibold text-slate-100">{value}</p>
        <p className="text-xs text-slate-500">{caption}</p>
      </CardContent>
    </Card>
  )
}

function TransferForm({
  districtId,
  accounts,
  transfer,
  createDraft,
  updateDraft,
  onSaved,
  onClose,
}: {
  districtId: string
  accounts: Account[]
  transfer?: Transfer | null
  createDraft: (payload: {
    district_id: string
    transfer_date: string
    from_account_id: string
    to_account_id: string
    amount: number
    description?: string | null
    client_generated_id?: string | null
    device_id?: string | null
  }) => Promise<Transfer>
  updateDraft: (id: string, payload: Partial<{
    transfer_date: string
    from_account_id: string
    to_account_id: string
    amount: number
    description: string | null
  }>) => Promise<Transfer>
  onSaved: () => void
  onClose: () => void
}) {
  const toast = useToast()
  const activeAccounts = accounts.filter((account) => account.status === 'active')

  const [form, setForm] = useState({
    transfer_date: transfer?.transfer_date ?? toIsoDate(new Date()),
    from_account_id: transfer?.from_account_id ?? activeAccounts[0]?.id ?? '',
    to_account_id: transfer?.to_account_id ?? activeAccounts[1]?.id ?? activeAccounts[0]?.id ?? '',
    amount: transfer ? String(transfer.amount) : '',
    description: transfer?.description ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fromAccount = activeAccounts.find((account) => account.id === form.from_account_id) ?? null
  const toAccount = activeAccounts.find((account) => account.id === form.to_account_id) ?? null

  const handleSave = async () => {
    setError(null)

    if (!form.transfer_date) {
      setError('Transfer date is required.')
      return
    }
    if (!form.from_account_id || !form.to_account_id) {
      setError('Choose both source and destination accounts.')
      return
    }
    if (form.from_account_id === form.to_account_id) {
      setError('Source and destination accounts must be different.')
      return
    }

    const amount = Number.parseFloat(form.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Amount must be greater than 0.')
      return
    }

    setSaving(true)
    try {
      if (transfer) {
        await updateDraft(transfer.id, {
          transfer_date: form.transfer_date,
          from_account_id: form.from_account_id,
          to_account_id: form.to_account_id,
          amount,
          description: form.description || null,
        })
        toast.success('Transfer draft updated')
      } else {
        await createDraft({
          district_id: districtId,
          transfer_date: form.transfer_date,
          from_account_id: form.from_account_id,
          to_account_id: form.to_account_id,
          amount,
          description: form.description || null,
        })
        toast.success('Transfer saved as draft')
      }

      onSaved()
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4">
        <Input
          label="Transfer Date *"
          type="date"
          value={form.transfer_date}
          onChange={(event) => setForm((current) => ({ ...current, transfer_date: event.target.value }))}
        />
        <Select
          label="From Account *"
          value={form.from_account_id}
          onChange={(event) => setForm((current) => ({ ...current, from_account_id: event.target.value }))}
          options={activeAccounts.map((account) => ({
            value: account.id,
            label: `${account.name} (${account.currency})`,
          }))}
          placeholder="Select source account"
        />
        <Select
          label="To Account *"
          value={form.to_account_id}
          onChange={(event) => setForm((current) => ({ ...current, to_account_id: event.target.value }))}
          options={activeAccounts.map((account) => ({
            value: account.id,
            label: `${account.name} (${account.currency})`,
          }))}
          placeholder="Select destination account"
        />
        <Input
          label={`Amount${fromAccount ? ` (${fromAccount.currency})` : ''} *`}
          type="number"
          min="0.01"
          step="0.01"
          value={form.amount}
          onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
          placeholder="0.00"
        />
        <Input
          label="Description"
          value={form.description}
          onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          placeholder="Optional transfer notes"
        />
      </div>

      {fromAccount && toAccount && fromAccount.currency !== toAccount.currency && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Transfers can only post between accounts that share the same currency.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2 border-t border-slate-700 pt-2">
        <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={handleSave} loading={saving}>
          {transfer ? 'Save changes' : 'Save draft'}
        </Button>
      </div>
    </div>
  )
}

function TransferDetail({
  transferId,
  accountMap,
}: {
  transferId: string
  accountMap: Map<string, Account>
}) {
  const supabase = createClient()
  const [data, setData] = useState<TransferDetailRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const response = await fetch(`/api/transfers/${transferId}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? 'Failed to load transfer')

      setData(json.data ?? null)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [supabase.auth, transferId])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Loader className="h-4 w-4 animate-spin" /> Loading...
      </div>
    )
  }

  if (error || !data) {
    return <div className="text-sm text-red-400">{error ?? 'Transfer not found'}</div>
  }

  const { from, to } = transferRouteLabel(data, accountMap)
  const currency = resolveTransferCurrency(data, accountMap)

  return (
    <div className="space-y-6 text-sm">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Badge variant={STATUS_BADGE_VARIANT[data.status]}>{TRANSFER_STATUS_LABELS[data.status]}</Badge>
          {data.reference_no && <span className="font-mono text-xs text-slate-500">{data.reference_no}</span>}
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          <dt className="text-slate-400">Date</dt>
          <dd className="text-slate-100">{formatDate(data.transfer_date)}</dd>
          <dt className="text-slate-400">From</dt>
          <dd className="text-slate-100">{from}</dd>
          <dt className="text-slate-400">To</dt>
          <dd className="text-slate-100">{to}</dd>
          <dt className="text-slate-400">Amount</dt>
          <dd className="text-slate-100 font-medium">{formatCurrency(data.amount, currency)}</dd>
          {data.description && (
            <>
              <dt className="text-slate-400">Description</dt>
              <dd className="text-slate-100">{data.description}</dd>
            </>
          )}
        </dl>
      </div>

      {data.effect_transactions.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Effect Rows</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="py-1 text-left text-slate-400">Date</th>
                <th className="py-1 text-left text-slate-400">Kind</th>
                <th className="py-1 text-left text-slate-400">Account</th>
                <th className="py-1 text-right text-slate-400">Amount</th>
                <th className="py-1 text-left text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.effect_transactions.map((transaction) => (
                <tr key={transaction.id} className="border-b border-slate-700/40 last:border-0">
                  <td className="py-2 text-slate-300">{formatDate(transaction.transaction_date)}</td>
                  <td className="py-2 text-slate-100">{transactionDisplayLabel(transaction)}</td>
                  <td className="py-2 text-slate-300">{(transaction.account as Account | null)?.name ?? 'Unknown account'}</td>
                  <td className="py-2 text-right font-mono text-slate-100">{formatCurrency(transaction.total_amount, transaction.currency)}</td>
                  <td className="py-2">
                    <Badge variant={transaction.status === 'posted' ? 'green' : transaction.status === 'reversed' ? 'red' : 'default'}>
                      {transaction.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">Timeline</p>
        <ol className="relative ml-2 space-y-4 border-l border-slate-700">
          <li className="ml-4">
            <span className="absolute -left-1.5 mt-0.5 h-3 w-3 rounded-full border border-slate-500 bg-slate-600" />
            <p className="text-slate-200">Draft created</p>
            <p className="text-xs text-slate-500">{new Date(data.created_at).toLocaleString('en-GB')}</p>
          </li>
          {data.posted_at && (
            <li className="ml-4">
              <span className="absolute -left-1.5 mt-0.5 h-3 w-3 rounded-full border border-emerald-500/40 bg-emerald-500/30" />
              <p className="text-slate-200">Posted</p>
              <p className="text-xs text-slate-500">{new Date(data.posted_at).toLocaleString('en-GB')}</p>
            </li>
          )}
          {data.reversed_at && (
            <li className="ml-4">
              <span className="absolute -left-1.5 mt-0.5 h-3 w-3 rounded-full border border-red-500/40 bg-red-500/30" />
              <p className="text-slate-200">Reversed</p>
              <p className="text-xs text-slate-500">{new Date(data.reversed_at).toLocaleString('en-GB')}</p>
            </li>
          )}
        </ol>
      </div>
    </div>
  )
}

export default function TransfersPage() {
  const { districtId } = useAuth()
  const { can } = usePermissions()
  const toast = useToast()

  const [statusFilter, setStatusFilter] = useState<TransferStatus | ''>('')
  const [accountFilter, setAccountFilter] = useState<string>('')
  const [search, setSearch] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState<Transfer | null>(null)
  const [reverseTarget, setReverseTarget] = useState<Transfer | null>(null)
  const [reverseNarration, setReverseNarration] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const { data: accounts, loading: accountsLoading } = useAccounts({ district_id: districtId })
  const {
    data: transfers,
    loading,
    createDraft,
    updateDraft,
    post,
    reverse,
    voidDraft,
    refresh,
  } = useTransfers({
    district_id: districtId,
  })

  const accountMap = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  )

  const filteredTransfers = useMemo(() => {
    return transfers.filter((transfer) => {
      if (statusFilter && transfer.status !== statusFilter) return false
      if (accountFilter && transfer.from_account_id !== accountFilter && transfer.to_account_id !== accountFilter) return false
      if (!search) return true

      const q = search.toLowerCase()
      const route = transferRouteLabel(transfer, accountMap)
      const reference = transfer.reference_no?.toLowerCase() ?? ''
      const description = transfer.description?.toLowerCase() ?? ''

      return (
        reference.includes(q)
        || description.includes(q)
        || route.from.toLowerCase().includes(q)
        || route.to.toLowerCase().includes(q)
      )
    })
  }, [accountFilter, accountMap, search, statusFilter, transfers])

  const postedTransfers = transfers.filter((transfer) => transfer.status === 'posted')
  const postedTotalsByCurrency = useMemo(() => {
    return postedTransfers.reduce<Record<string, number>>((acc, transfer) => {
      const currency = resolveTransferCurrency(transfer, accountMap)
      acc[currency] = (acc[currency] ?? 0) + transfer.amount
      return acc
    }, {})
  }, [accountMap, postedTransfers])

  const canViewTransfers = can('transfers.view')
  const canDraftTransfers = can('transfers.draft')
  const canPostTransfers = can('transfers.post')
  const canReverseTransfers = can('transfers.reverse')

  const handlePost = async (transfer: Transfer) => {
    setActionLoading(`post:${transfer.id}`)
    try {
      await post(transfer.id)
      toast.success('Transfer posted')
    } catch (err) {
      toast.error(String(err))
    } finally {
      setActionLoading(null)
    }
  }

  const handleVoid = async (transfer: Transfer) => {
    setActionLoading(`void:${transfer.id}`)
    try {
      await voidDraft(transfer.id)
      toast.success('Transfer voided')
    } catch (err) {
      toast.error(String(err))
    } finally {
      setActionLoading(null)
    }
  }

  const handleReverse = async () => {
    if (!reverseTarget) return

    setActionLoading(`reverse:${reverseTarget.id}`)
    try {
      await reverse(reverseTarget.id, reverseNarration || undefined)
      toast.success('Transfer reversed')
      setReverseTarget(null)
      setReverseNarration('')
    } catch (err) {
      toast.error(String(err))
    } finally {
      setActionLoading(null)
    }
  }

  if (!districtId) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <SelectDistrictHint description="Choose a district to manage transfers between its accounts." />
      </div>
    )
  }

  if (!canViewTransfers) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <div className="rounded-xl border border-slate-700 bg-slate-800/80 p-6 text-sm text-slate-400">
          You do not have permission to view transfers in this district.
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <PageHeader
        title="Transfers"
        description="Move funds between district-owned accounts with a dedicated posting and reversal workflow."
        actions={canDraftTransfers ? (
          <Button onClick={() => setNewOpen(true)} disabled={accountsLoading || accounts.length < 2}>
            <ArrowRightLeft className="h-4 w-4" />
            New transfer
          </Button>
        ) : null}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TransferMetricCard
          label="Drafts"
          value={String(transfers.filter((transfer) => transfer.status === 'draft').length)}
          caption="Transfers waiting to post or void"
        />
        <TransferMetricCard
          label="Posted"
          value={String(postedTransfers.length)}
          caption="Transfers currently affecting account cashbooks"
        />
        <TransferMetricCard
          label="Reversed"
          value={String(transfers.filter((transfer) => transfer.status === 'reversed').length)}
          caption="Transfers that have been compensated"
        />
        <TransferMetricCard
          label="Moved"
          value={Object.entries(postedTotalsByCurrency)
            .map(([currency, amount]) => formatCurrency(amount, currency as Currency))
            .join(' / ') || '-'}
          caption="Posted transfer volume by currency"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Select
          label="Status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as TransferStatus | '')}
          options={STATUS_FILTER_OPTIONS}
          placeholder="All statuses"
        />
        <Select
          label="Account"
          value={accountFilter}
          onChange={(event) => setAccountFilter(event.target.value)}
          options={accounts.map((account) => ({
            value: account.id,
            label: `${account.name}${account.status === 'archived' ? ' (Archived)' : ''}`,
          }))}
          placeholder="All accounts"
        />
        <div className="xl:col-span-2">
          <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Search</label>
          <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-slate-700 bg-[var(--field-bg)] px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-slate-500" />
            <input
              className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-slate-500"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search reference, route, or description"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <PageSpinner />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800">
          <div className="border-b border-slate-700 px-4 py-4 md:px-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">Transfer Register</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {filteredTransfers.length} transfer{filteredTransfers.length === 1 ? '' : 's'}
                </p>
              </div>
              <Button variant="ghost" onClick={() => void refresh()}>
                Refresh
              </Button>
            </div>
          </div>

          {filteredTransfers.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-500">
              No transfers match the current filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="px-4 py-3 text-left font-medium text-slate-400">Date</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-400">Reference</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-400">Route</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-400">Description</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-400">Amount</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-400">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filteredTransfers.map((transfer) => {
                    const { label } = transferRouteLabel(transfer, accountMap)
                    const currency = resolveTransferCurrency(transfer, accountMap)
                    const isPosting = actionLoading === `post:${transfer.id}`
                    const isVoiding = actionLoading === `void:${transfer.id}`
                    const canEdit = transfer.status === 'draft' && canDraftTransfers
                    const canPost = transfer.status === 'draft' && canPostTransfers
                    const canVoid = transfer.status === 'draft' && canDraftTransfers
                    const canReverse = transfer.status === 'posted' && canReverseTransfers

                    return (
                      <tr key={transfer.id} className="border-b border-slate-700/50 last:border-0 hover:bg-slate-700/20">
                        <td className="whitespace-nowrap px-4 py-3.5 text-slate-300">{formatDate(transfer.transfer_date)}</td>
                        <td className="whitespace-nowrap px-4 py-3.5 font-mono text-xs text-slate-500">
                          {transfer.reference_no ?? <span className="text-slate-700">-</span>}
                        </td>
                        <td className="px-4 py-3.5 text-slate-100">{label}</td>
                        <td className="max-w-[280px] px-4 py-3.5 text-slate-300">
                          {transfer.description ?? <span className="text-slate-700">-</span>}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-slate-100">
                          {formatCurrency(transfer.amount, currency)}
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge variant={STATUS_BADGE_VARIANT[transfer.status]}>
                            {TRANSFER_STATUS_LABELS[transfer.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                            {canEdit && (
                              <Button size="sm" variant="ghost" onClick={() => setEditTarget(transfer)} title="Edit draft">
                                Edit
                              </Button>
                            )}
                            {canPost && (
                              <Button size="sm" variant="secondary" onClick={() => void handlePost(transfer)} loading={isPosting}>
                                <Send className="h-3.5 w-3.5" />
                                Post
                              </Button>
                            )}
                            {canVoid && (
                              <Button size="sm" variant="ghost" onClick={() => void handleVoid(transfer)} loading={isVoiding} className="text-red-400 hover:text-red-300">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {canReverse && (
                              <Button size="sm" variant="ghost" onClick={() => { setReverseTarget(transfer); setReverseNarration('') }} className="text-amber-400 hover:text-amber-300">
                                <RotateCcw className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => setDetailId(transfer.id)} title="View detail">
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
      )}

      <SlideOver open={newOpen} onClose={() => setNewOpen(false)} title="New Transfer">
        <TransferForm
          districtId={districtId}
          accounts={accounts}
          createDraft={createDraft}
          updateDraft={updateDraft}
          onSaved={() => {
            setNewOpen(false)
            void refresh()
          }}
          onClose={() => setNewOpen(false)}
        />
      </SlideOver>

      <SlideOver open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Draft Transfer">
        {editTarget && (
          <TransferForm
            districtId={districtId}
            accounts={accounts}
            transfer={editTarget}
            createDraft={createDraft}
            updateDraft={updateDraft}
            onSaved={() => {
              setEditTarget(null)
              void refresh()
            }}
            onClose={() => setEditTarget(null)}
          />
        )}
      </SlideOver>

      <SlideOver open={!!detailId} onClose={() => setDetailId(null)} title="Transfer Detail">
        {detailId && (
          <TransferDetail
            transferId={detailId}
            accountMap={accountMap}
          />
        )}
      </SlideOver>

      <Modal open={!!reverseTarget} onClose={() => setReverseTarget(null)} title="Reverse Transfer" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            This will create compensating transfer effect rows and mark the original transfer as reversed.
          </p>
          <div>
            <label className="mb-1 block text-sm text-slate-400">Reason (optional)</label>
            <input
              className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
              value={reverseNarration}
              onChange={(event) => setReverseNarration(event.target.value)}
              placeholder="e.g. Sent to the wrong account"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setReverseTarget(null)} disabled={!!actionLoading}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => void handleReverse()}
              loading={!!reverseTarget && actionLoading === `reverse:${reverseTarget.id}`}
            >
              Reverse
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
