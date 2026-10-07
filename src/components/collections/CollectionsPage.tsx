'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { Ban, CheckCircle2, Coins, Inbox, PencilLine, Plus, Settings2, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { Select } from '@/components/ui/Select'
import { PageSpinner } from '@/components/ui/Spinner'
import { StatCard } from '@/components/ui/StatCard'
import { useToast } from '@/components/ui/Toast'
import { SelectDistrictHint } from '@/components/layout/SelectDistrictHint'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { useAccounts } from '@/hooks/useAccounts'
import { useCollections, type CollectionLineInput } from '@/hooks/useCollections'
import { useCurrencies } from '@/hooks/useCurrencies'
import { useFunds } from '@/hooks/useFunds'
import { useMembers } from '@/hooks/useMembers'
import { collectionScope, isWithinScope } from '@/lib/auth/permissions'
import {
  canVoidCollection,
  COLLECTION_STATUS_LABELS,
  collectionTotal,
  lineContributor,
  totalsByScope,
  unpostedLines,
} from '@/lib/finance/collections'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import type { Collection, CollectionStatus, CollectionType, Member } from '@/types'

const TITLE = 'Collections'
const DESCRIPTION = 'Money gathered by regions, assemblies and ministries, before it is handed over and posted to funds.'

const STATUS_BADGE: Record<CollectionStatus, 'yellow' | 'teal' | 'green' | 'default'> = {
  recorded: 'yellow',
  submitted: 'teal',
  posted: 'green',
  voided: 'default',
}

const SCOPE_TYPE_LABEL: Partial<Record<Member['type'], string>> = {
  region: 'Region',
  assembly: 'Assembly',
  department: 'Ministry',
}

interface LineDraft {
  key: string
  collection_type_id: string
  /** 'member' picks an individual; 'name' is free text or a lump sum. */
  mode: 'member' | 'name'
  member_id: string
  contributor_name: string
  amount: string
}

interface FormState {
  scope_member_id: string
  collected_on: string
  reference: string
  notes: string
  currency: string
  lines: LineDraft[]
}

let lineCounter = 0
const newLine = (typeId = ''): LineDraft => ({
  key: `line-${++lineCounter}`,
  collection_type_id: typeId,
  mode: 'member',
  member_id: '',
  contributor_name: '',
  amount: '',
})

const todayIso = () => new Date().toISOString().slice(0, 10)

function validateForm(form: FormState): string | null {
  if (!form.scope_member_id) return 'Choose where the collection came from'
  if (!form.collected_on) return 'Collection date is required'
  if (!form.currency) return 'Currency is required'
  if (form.lines.length === 0) return 'Add at least one line'
  for (const [index, line] of form.lines.entries()) {
    const row = `Line ${index + 1}`
    if (!line.collection_type_id) return `${row}: choose a collection type`
    if (line.mode === 'member' && !line.member_id) return `${row}: choose a member, or switch to a name / lump sum`
    if (line.mode === 'name' && !line.contributor_name.trim()) return `${row}: enter a name or description`
    const amount = Number(line.amount)
    if (!Number.isFinite(amount) || amount <= 0) return `${row}: amount must be greater than 0`
  }
  return null
}

function toLineInputs(lines: LineDraft[]): CollectionLineInput[] {
  return lines.map((line) => ({
    collection_type_id: line.collection_type_id,
    member_id: line.mode === 'member' ? line.member_id : null,
    contributor_name: line.mode === 'name' ? line.contributor_name.trim() : null,
    amount: Math.round(Number(line.amount) * 100) / 100,
  }))
}

type Dialog =
  | { kind: 'form' }
  | { kind: 'view'; collection: Collection }
  | { kind: 'post'; collection: Collection }
  | { kind: 'types' }

export function CollectionsPage() {
  const { districtId, district } = useAuth()
  const { can, role, scopeMemberId, isSuperuser, financeCommittee } = usePermissions()
  const toast = useToast()
  const {
    data: collections, types, loading, error,
    add, voidCollection, submit, post, addType, updateType,
  } = useCollections(districtId)
  const { data: members } = useMembers({ district_id: districtId })
  const canHandle = can('collections.submit')
  const canPost = can('collections.post')
  const canManageTypes = can('collections.types.manage')
  const { data: funds } = useFunds({ district_id: canPost || canManageTypes ? districtId : null })
  const { data: accounts } = useAccounts({ district_id: canPost ? districtId : null })
  const { data: currencies } = useCurrencies()

  const recordScope = collectionScope('collections.record', role, isSuperuser, financeCommittee)
  const viewScope = collectionScope('collections.view', role, isSuperuser, financeCommittee)

  const [statusFilter, setStatusFilter] = useState<CollectionStatus | 'all'>('all')
  const [unitFilter, setUnitFilter] = useState('')
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmVoid, setConfirmVoid] = useState<Collection | null>(null)
  const [postForm, setPostForm] = useState<{ account_id: string; transaction_date: string; funds: Record<string, string> }>({
    account_id: '', transaction_date: '', funds: {},
  })
  const [typeForm, setTypeForm] = useState({ name: '', code: '', suggested_fund_id: '' })

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members])
  const memberName = (id: string) => memberById.get(id)?.name ?? null
  const typeName = (id: string) => types.find((t) => t.id === id)?.name ?? 'Unknown type'

  const units = useMemo(
    () => members.filter((m) => m.is_active && (m.type === 'region' || m.type === 'assembly' || m.type === 'department')),
    [members],
  )
  const recordableUnits = useMemo(
    () => (recordScope === 'district' ? units : recordScope === 'scope' ? units.filter((u) => isWithinScope(scopeMemberId, u.id, members)) : []),
    [recordScope, units, scopeMemberId, members],
  )
  const unitLabel = (id: string) => {
    const unit = memberById.get(id)
    return unit ? `${unit.name}${SCOPE_TYPE_LABEL[unit.type] ? ` · ${SCOPE_TYPE_LABEL[unit.type]}` : ''}` : 'Unknown'
  }

  const visible = collections.filter(
    (c) => (statusFilter === 'all' || c.status === statusFilter)
      && (!unitFilter || isWithinScope(unitFilter, c.scope_member_id, members)),
  )
  const currency = district?.default_currency ?? 'USD'
  const totalFor = (status: CollectionStatus) =>
    collectionTotal(collections.filter((c) => c.status === status).flatMap((c) => c.lines ?? []))
  const byUnit = [...totalsByScope(visible.filter((c) => c.status !== 'voided')).entries()].sort((a, b) => b[1] - a[1])

  if (!districtId) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <PageHeader title={TITLE} description={DESCRIPTION} />
        <SelectDistrictHint description="Choose a district to see its collections." />
      </div>
    )
  }

  // Secretaries can withdraw their own collection until it is handed over;
  // finance can until any line is posted to a fund.
  const canVoid = (c: Collection) => canVoidCollection(c)
    && (canHandle || (c.status === 'recorded' && recordableUnits.some((u) => u.id === c.scope_member_id)))

  // ── record ─────────────────────────────────────────────────────────────────

  const activeTypes = types.filter((t) => t.is_active)

  const openForm = () => {
    setForm({
      scope_member_id: recordableUnits.length === 1 ? recordableUnits[0].id : '',
      collected_on: todayIso(),
      reference: '',
      notes: '',
      currency,
      lines: [newLine(activeTypes.length === 1 ? activeTypes[0].id : '')],
    })
    setDialog({ kind: 'form' })
  }

  const contributorOptions = (scopeId: string) => {
    const scope = memberById.get(scopeId)
    // Individuals sit under assemblies; ministries draw from the whole district.
    return members
      .filter((m) => m.type === 'individual' && m.is_active && (!scope || scope.type === 'department' || isWithinScope(scopeId, m.id, members)))
      .map((m) => ({ value: m.id, label: m.name }))
  }

  const setLine = (key: string, patch: Partial<LineDraft>) =>
    setForm((current) => current && { ...current, lines: current.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) })

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!form || dialog?.kind !== 'form') return
    const problem = validateForm(form)
    if (problem) {
      toast.error(problem)
      return
    }
    const values = {
      scope_member_id: form.scope_member_id,
      collected_on: form.collected_on,
      reference: form.reference.trim() || null,
      notes: form.notes.trim() || null,
      currency: form.currency,
    }
    setSaving(true)
    try {
      await add(values, toLineInputs(form.lines))
      toast.success('Collection posted')
      setDialog(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  // ── hand-over ──────────────────────────────────────────────────────────────

  const run = async (action: () => Promise<void>, success: string) => {
    setSaving(true)
    try {
      await action()
      toast.success(success)
      setDialog(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const openPost = (collection: Collection) => {
    const typeIds = [...new Set(unpostedLines(collection.lines ?? []).map((l) => l.collection_type_id))]
    const matchingAccounts = accounts.filter((a) => a.status === 'active' && a.currency === collection.currency)
    setPostForm({
      account_id: matchingAccounts.length === 1 ? matchingAccounts[0].id : '',
      transaction_date: collection.collected_on,
      funds: Object.fromEntries(typeIds.map((id) => [id, types.find((t) => t.id === id)?.suggested_fund_id ?? ''])),
    })
    setDialog({ kind: 'post', collection })
  }

  const handlePost = (e: FormEvent) => {
    e.preventDefault()
    if (dialog?.kind !== 'post') return
    if (!postForm.account_id) {
      toast.error('Choose the account that received the money')
      return
    }
    if (Object.values(postForm.funds).some((fundId) => !fundId)) {
      toast.error('Choose a fund for every collection type')
      return
    }
    void run(
      () => post(dialog.collection.id, postForm),
      'Collection posted to funds',
    )
  }

  // ── types ──────────────────────────────────────────────────────────────────

  const handleAddType = (e: FormEvent) => {
    e.preventDefault()
    if (!typeForm.name.trim()) {
      toast.error('Name is required')
      return
    }
    void (async () => {
      try {
        await addType({
          name: typeForm.name.trim(),
          code: typeForm.code.trim() || null,
          suggested_fund_id: typeForm.suggested_fund_id || null,
          is_active: true,
        })
        setTypeForm({ name: '', code: '', suggested_fund_id: '' })
        toast.success('Collection type added')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err))
      }
    })()
  }

  const fundOptions = funds.filter((f) => f.is_active && f.nature !== 'expense_only').map((f) => ({ value: f.id, label: f.name }))
  const currencyOptions = currencies.filter((c) => c.is_active).map((c) => ({ value: c.code, label: c.code }))

  // ── render ─────────────────────────────────────────────────────────────────

  const viewing = dialog?.kind === 'view' ? dialog.collection : null

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <PageHeader
        title={TITLE}
        description={DESCRIPTION}
        actions={(
          <div className="flex flex-wrap gap-2">
            {canManageTypes && (
              <Button variant="secondary" onClick={() => setDialog({ kind: 'types' })}>
                <Settings2 className="h-4 w-4" />
                Collection types
              </Button>
            )}
            {recordableUnits.length > 0 && (
              <Button onClick={openForm} disabled={activeTypes.length === 0} title={activeTypes.length === 0 ? 'Ask the Accounting Officer to add collection types first' : undefined}>
                <Plus className="h-4 w-4" />
                Post collection
              </Button>
            )}
          </div>
        )}
      />

      {viewScope === 'scope' && scopeMemberId && (
        <p className="text-sm text-[var(--text-tertiary)]">Showing collections for {unitLabel(scopeMemberId)}.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Awaiting hand-over" value={formatCurrency(totalFor('recorded'), currency)} icon={<PencilLine className="h-5 w-5" />} />
        <StatCard label="Submitted to office" value={formatCurrency(totalFor('submitted'), currency)} icon={<Inbox className="h-5 w-5" />} />
        <StatCard label="Posted to funds" value={formatCurrency(totalFor('posted'), currency)} icon={<CheckCircle2 className="h-5 w-5" />} />
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-3 border-b px-5 py-3 [border-color:var(--border-subtle)]">
          <div className="w-48">
            <Select
              aria-label="Status"
              value={statusFilter}
              options={[
                { value: 'all', label: 'All statuses' },
                ...(['recorded', 'submitted', 'posted', 'voided'] as const).map((s) => ({ value: s, label: COLLECTION_STATUS_LABELS[s] })),
              ]}
              onChange={(e) => setStatusFilter(e.target.value as CollectionStatus | 'all')}
            />
          </div>
          {viewScope === 'district' && (
            <div className="w-64">
              <SearchableSelect
                value={unitFilter}
                onChange={setUnitFilter}
                options={[{ value: '', label: 'All units' }, ...units.map((u) => ({ value: u.id, label: unitLabel(u.id) }))]}
                placeholder="All units"
              />
            </div>
          )}
        </div>

        {loading ? (
          <PageSpinner />
        ) : error ? (
          <CardContent><p className="text-sm text-red-400">{error}</p></CardContent>
        ) : visible.length === 0 ? (
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Coins className="h-8 w-8 text-[var(--text-muted)]" />
            <p className="text-sm text-[var(--text-tertiary)]">No collections yet.</p>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--text-tertiary)]">
                  <th className="px-5 py-2 font-medium">Date</th>
                  <th className="px-5 py-2 font-medium">From</th>
                  <th className="px-5 py-2 font-medium">Reference</th>
                  <th className="px-5 py-2 text-right font-medium">Lines</th>
                  <th className="px-5 py-2 text-right font-medium">Total</th>
                  <th className="px-5 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y [&>tr]:[border-color:var(--border-subtle)]">
                {visible.map((c) => (
                  <tr
                    key={c.id}
                    className="cursor-pointer hover:bg-[var(--button-ghost-hover)]"
                    onClick={() => setDialog({ kind: 'view', collection: c })}
                  >
                    <td className="whitespace-nowrap px-5 py-3 text-[var(--text-primary)]">{c.collected_on}</td>
                    <td className="px-5 py-3 text-[var(--text-primary)]">{unitLabel(c.scope_member_id)}</td>
                    <td className="px-5 py-3 text-[var(--text-secondary)]">{c.reference ?? '—'}</td>
                    <td className="px-5 py-3 text-right text-[var(--text-secondary)]">{c.lines?.length ?? 0}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-right font-medium text-[var(--text-primary)]">
                      {formatCurrency(collectionTotal(c.lines ?? []), c.currency)}
                    </td>
                    <td className="px-5 py-3"><Badge variant={STATUS_BADGE[c.status]}>{COLLECTION_STATUS_LABELS[c.status]}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {byUnit.length > 1 && (
        <Card>
          <CardHeader><CardTitle>Totals by unit</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <ul className="divide-y text-sm [&>li]:[border-color:var(--border-subtle)]">
              {byUnit.map(([unitId, total]) => (
                <li key={unitId} className="flex justify-between py-2">
                  <span className="text-[var(--text-primary)]">{unitLabel(unitId)}</span>
                  <span className="font-medium text-[var(--text-primary)]">{formatCurrency(total, currency)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* View */}
      <Modal open={viewing !== null && confirmVoid === null} onClose={() => setDialog(null)} title="Collection">
        {viewing && (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-[var(--text-tertiary)]">From</dt><dd className="text-[var(--text-primary)]">{unitLabel(viewing.scope_member_id)}</dd></div>
              <div><dt className="text-xs text-[var(--text-tertiary)]">Date</dt><dd className="text-[var(--text-primary)]">{viewing.collected_on}</dd></div>
              <div><dt className="text-xs text-[var(--text-tertiary)]">Reference</dt><dd className="text-[var(--text-primary)]">{viewing.reference ?? '—'}</dd></div>
              <div><dt className="text-xs text-[var(--text-tertiary)]">Status</dt><dd><Badge variant={STATUS_BADGE[viewing.status]}>{COLLECTION_STATUS_LABELS[viewing.status]}</Badge></dd></div>
            </dl>
            {viewing.notes && <p className="whitespace-pre-wrap text-sm text-[var(--text-secondary)]">{viewing.notes}</p>}
            <ul className="divide-y text-sm [&>li]:[border-color:var(--border-subtle)]">
              {(viewing.lines ?? []).map((line) => (
                <li key={line.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-[var(--text-primary)]">{lineContributor(line, memberName)}</p>
                    <p className="text-xs text-[var(--text-tertiary)]">
                      {typeName(line.collection_type_id)}{line.cashbook_transaction_id ? ' · posted' : ''}
                    </p>
                  </div>
                  <span className="whitespace-nowrap font-medium text-[var(--text-primary)]">{formatCurrency(Number(line.amount), viewing.currency)}</span>
                </li>
              ))}
              <li className="flex justify-between py-2 font-semibold text-[var(--text-primary)]">
                <span>Total</span>
                <span>{formatCurrency(collectionTotal(viewing.lines ?? []), viewing.currency)}</span>
              </li>
            </ul>
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              {canVoid(viewing) && (
                <Button variant="ghost" onClick={() => setConfirmVoid(viewing)}>
                  <Ban className="h-4 w-4" />
                  Void
                </Button>
              )}
              {canHandle && viewing.status === 'recorded' && (
                <Button loading={saving} onClick={() => void run(() => submit(viewing.id), 'Marked as submitted to office')}>
                  Mark submitted to office
                </Button>
              )}
              {canPost && viewing.status === 'submitted' && (
                <Button onClick={() => openPost(viewing)}>Post to funds</Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Post collection */}
      <Modal
        open={dialog?.kind === 'form' && form !== null}
        onClose={() => setDialog(null)}
        title="Post collection"
        size="lg"
      >
        {form && (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                id="collection-unit"
                label="From"
                value={form.scope_member_id}
                options={recordableUnits.map((u) => ({ value: u.id, label: unitLabel(u.id) }))}
                placeholder="Choose a region, assembly or ministry…"
                onChange={(e) => setForm({ ...form, scope_member_id: e.target.value })}
              />
              <Input
                id="collection-date"
                label="Collected on"
                type="date"
                value={form.collected_on}
                onChange={(e) => setForm({ ...form, collected_on: e.target.value })}
              />
              <Input
                id="collection-reference"
                label="Reference (optional)"
                value={form.reference}
                placeholder="e.g. Sunday service"
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
              />
              <Select
                id="collection-currency"
                label="Currency"
                value={form.currency}
                options={currencyOptions.length ? currencyOptions : [{ value: form.currency, label: form.currency }]}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-[var(--text-secondary)]">Lines</p>
              {form.lines.map((line) => (
                <div key={line.key} className="grid gap-2 rounded-sm border p-2 [border-color:var(--border-subtle)] sm:grid-cols-[1fr_1.4fr_7rem_auto] sm:items-end">
                  <Select
                    aria-label="Collection type"
                    value={line.collection_type_id}
                    options={activeTypes.map((t) => ({ value: t.id, label: t.name }))}
                    placeholder="Type…"
                    onChange={(e) => setLine(line.key, { collection_type_id: e.target.value })}
                  />
                  <div className="space-y-1">
                    {line.mode === 'member' ? (
                      <SearchableSelect
                        value={line.member_id}
                        onChange={(value) => setLine(line.key, { member_id: value })}
                        options={contributorOptions(form.scope_member_id)}
                        placeholder="Member…"
                      />
                    ) : (
                      <Input
                        aria-label="Name or description"
                        value={line.contributor_name}
                        placeholder="Name, or e.g. Loose offering"
                        onChange={(e) => setLine(line.key, { contributor_name: e.target.value })}
                      />
                    )}
                    <button
                      type="button"
                      className="text-xs text-[var(--accent-solid)] hover:underline"
                      onClick={() => setLine(line.key, { mode: line.mode === 'member' ? 'name' : 'member' })}
                    >
                      {line.mode === 'member' ? 'Not a listed member / lump sum' : 'Pick a member instead'}
                    </button>
                  </div>
                  <Input
                    aria-label="Amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.amount}
                    placeholder="0.00"
                    onChange={(e) => setLine(line.key, { amount: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Remove line"
                    disabled={form.lines.length === 1}
                    onClick={() => setForm({ ...form, lines: form.lines.filter((l) => l.key !== line.key) })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setForm({ ...form, lines: [...form.lines, newLine(form.lines.at(-1)?.collection_type_id ?? '')] })}
                >
                  <Plus className="h-4 w-4" />
                  Add line
                </Button>
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  Total {formatCurrency(collectionTotal(form.lines.map((l) => ({ amount: Number(l.amount) || 0 }))), form.currency)}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="collection-notes" className="text-sm font-medium text-[var(--text-secondary)]">Notes (optional)</label>
              <textarea
                id="collection-notes"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full rounded-sm border bg-[var(--field-bg)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-[var(--field-shadow)] outline-none [border-color:var(--field-border)] hover:[border-color:var(--field-border-hover)] focus:ring-2 focus:ring-[var(--accent-ring)] focus:[border-color:var(--accent-border)]"
              />
            </div>

            <p className="text-xs text-[var(--text-tertiary)]">
              Posted collections can’t be edited. If something is wrong, void it and post it again.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setDialog(null)} disabled={saving}>Cancel</Button>
              <Button type="submit" loading={saving}>Post collection</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Post to funds */}
      <Modal open={dialog?.kind === 'post'} onClose={() => setDialog(null)} title="Post to funds">
        {dialog?.kind === 'post' && (
          <form onSubmit={handlePost} className="space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Each line becomes a posted receipt in the cashbook, linked to its member where there is one.
            </p>
            <Select
              id="post-account"
              label="Received into account"
              value={postForm.account_id}
              options={accounts
                .filter((a) => a.status === 'active' && a.currency === dialog.collection.currency)
                .map((a) => ({ value: a.id, label: a.name }))}
              placeholder="Choose an account…"
              onChange={(e) => setPostForm({ ...postForm, account_id: e.target.value })}
            />
            <Input
              id="post-date"
              label="Transaction date"
              type="date"
              value={postForm.transaction_date}
              onChange={(e) => setPostForm({ ...postForm, transaction_date: e.target.value })}
            />
            {Object.keys(postForm.funds).map((typeId) => (
              <Select
                key={typeId}
                id={`post-fund-${typeId}`}
                label={`${typeName(typeId)} → fund`}
                value={postForm.funds[typeId]}
                options={fundOptions}
                placeholder="Choose a fund…"
                onChange={(e) => setPostForm({ ...postForm, funds: { ...postForm.funds, [typeId]: e.target.value } })}
              />
            ))}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setDialog({ kind: 'view', collection: dialog.collection })} disabled={saving}>Back</Button>
              <Button type="submit" loading={saving}>
                Post {formatCurrency(collectionTotal(unpostedLines(dialog.collection.lines ?? [])), dialog.collection.currency)}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Collection types */}
      <Modal open={dialog?.kind === 'types'} onClose={() => setDialog(null)} title="Collection types">
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            Types are what secretaries record against. The suggested fund is only a default when posting.
          </p>
          {types.length > 0 && (
            <ul className="divide-y text-sm [&>li]:[border-color:var(--border-subtle)]">
              {types.map((type: CollectionType) => (
                <li key={type.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[var(--text-primary)]">{type.name}{type.code ? ` (${type.code})` : ''}</p>
                  </div>
                  <div className="w-44">
                    <Select
                      aria-label={`Suggested fund for ${type.name}`}
                      value={type.suggested_fund_id ?? ''}
                      options={fundOptions}
                      placeholder="No suggested fund"
                      onChange={(e) => void updateType(type.id, { suggested_fund_id: e.target.value || null }).catch((err) => toast.error(String(err)))}
                    />
                  </div>
                  <label className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                    <input
                      type="checkbox"
                      checked={type.is_active}
                      onChange={(e) => void updateType(type.id, { is_active: e.target.checked }).catch((err) => toast.error(String(err)))}
                      className="h-4 w-4 accent-[var(--accent-solid)]"
                    />
                    Active
                  </label>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={handleAddType} className="grid gap-2 sm:grid-cols-[1fr_6rem_1fr_auto] sm:items-end">
            <Input id="type-name" label="Name" value={typeForm.name} placeholder="e.g. Tithes" onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })} />
            <Input id="type-code" label="Code" value={typeForm.code} onChange={(e) => setTypeForm({ ...typeForm, code: e.target.value })} />
            <Select
              id="type-fund"
              label="Suggested fund"
              value={typeForm.suggested_fund_id}
              options={fundOptions}
              placeholder="None"
              onChange={(e) => setTypeForm({ ...typeForm, suggested_fund_id: e.target.value })}
            />
            <Button type="submit">Add</Button>
          </form>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmVoid !== null}
        onClose={() => setConfirmVoid(null)}
        onConfirm={() => confirmVoid && void run(async () => { await voidCollection(confirmVoid.id); setConfirmVoid(null) }, 'Collection voided')}
        title="Void collection?"
        message="It stays on record as voided and won’t be posted to funds. Post a corrected collection if needed."
        confirmLabel="Void"
        loading={saving}
      />
    </div>
  )
}
