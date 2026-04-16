'use client'

import { useEffect, useState } from 'react'
import {
  CheckCircle,
  AlertCircle,
  Trash2,
  Building2,
  Landmark,
  PiggyBank,
  Pencil,
  Plus,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Scale,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { useDistricts } from '@/hooks/useDistricts'
import { useCurrencies } from '@/hooks/useCurrencies'
import { useAccounts } from '@/hooks/useAccounts'
import { useOpeningBalances } from '@/hooks/useOpeningBalances'
import { useFunds } from '@/hooks/useFunds'
import { SelectDistrictHint } from '@/components/layout/SelectDistrictHint'
import {
  ACCOUNT_STATUS_LABELS,
  ACCOUNT_TYPE_LABELS,
  FUND_NATURE_LABELS,
  Account,
  AccountOpeningBalance,
  AccountStatus,
  AccountType,
  Currency,
  Fund,
  FundNature,
} from '@/types'


interface FundFormState {
  name: string
  code: string
  description: string
  is_restricted: boolean
  nature: FundNature
  is_active: boolean
  requires_individual_source: boolean
}

interface AccountFormState {
  name: string
  code: string
  type: AccountType
  currency: Currency
  status: AccountStatus
  description: string
  sort_order: string
  institution_name: string
  institution_account_number: string
}

const emptyFundForm: FundFormState = {
  name: '',
  code: '',
  description: '',
  is_restricted: false,
  nature: 'mixed',
  is_active: true,
  requires_individual_source: false,
}

const emptyAccountForm: AccountFormState = {
  name: '',
  code: '',
  type: 'cash',
  currency: 'USD',
  status: 'active',
  description: '',
  sort_order: '0',
  institution_name: '',
  institution_account_number: '',
}



function DistrictSettings({ districtId }: { districtId: string }) {
  const { data: districts, update } = useDistricts()
  const toast = useToast()
  const district = districts.find((d) => d.id === districtId)

  const [name, setName] = useState(district?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (district) setName(district.name)
  }, [district?.name]) // eslint-disable-line

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await update(districtId, { name: name.trim() })
      setSaved(true)
      toast.success('District updated')
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
      <h2 className="font-semibold text-slate-100 flex items-center gap-2">
        <Building2 className="h-5 w-5 text-cyan-400" />
        District Settings
      </h2>
      <div className="flex items-end gap-3">
        <div className="flex-1 max-w-sm">
          <Input
            label="District name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="District name"
          />
        </div>
        <Button onClick={handleSave} disabled={saving || !name.trim() || name.trim() === district?.name} loading={saving}>
          Save
        </Button>
      </div>
      {saved && (
        <div className="flex items-center gap-2 text-sm text-green-400">
          <CheckCircle className="h-4 w-4 shrink-0" />
          District name updated
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  )
}

interface OpeningBalanceFormState {
  effective_date: string
  amount: string
  notes: string
}

const emptyBalanceForm = (): OpeningBalanceFormState => ({
  effective_date: new Date().toISOString().split('T')[0],
  amount: '',
  notes: '',
})

function AccountOpeningBalancesPanel({ account, districtId }: { account: Account; districtId: string }) {
  const { data: balances, loading, add, update, remove } = useOpeningBalances({ account_id: account.id, district_id: districtId })
  const toast = useToast()

  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<OpeningBalanceFormState>(emptyBalanceForm)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [draftBalance, setDraftBalance] = useState<OpeningBalanceFormState>(emptyBalanceForm)

  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; balance: AccountOpeningBalance | null }>({
    open: false,
    balance: null,
  })
  const [deleting, setDeleting] = useState(false)

  const handleAdd = async () => {
    const amount = parseFloat(form.amount)
    if (!form.effective_date) { toast.error('Effective date is required'); return }
    if (isNaN(amount) || amount < 0) { toast.error('Amount must be 0 or greater'); return }

    setSaving(true)
    try {
      await add({
        account_id: account.id,
        district_id: districtId,
        effective_date: form.effective_date,
        amount,
        currency: account.currency,
        notes: form.notes || null,
      })
      setForm(emptyBalanceForm)
      setAdding(false)
      toast.success('Opening balance saved')
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (b: AccountOpeningBalance) => {
    setEditingId(b.id)
    setDraftBalance({ effective_date: b.effective_date, amount: String(b.amount), notes: b.notes ?? '' })
  }

  const saveEdit = async (id: string) => {
    const amount = parseFloat(draftBalance.amount)
    if (isNaN(amount) || amount < 0) { toast.error('Amount must be 0 or greater'); return }
    setEditSaving(true)
    try {
      await update(id, { effective_date: draftBalance.effective_date, amount, notes: draftBalance.notes || null })
      setEditingId(null)
      toast.success('Opening balance updated')
    } catch (e) {
      toast.error(String(e))
    } finally {
      setEditSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete.balance) return
    setDeleting(true)
    try {
      await remove(confirmDelete.balance.id)
      setConfirmDelete({ open: false, balance: null })
      toast.success('Opening balance deleted')
    } catch (e) {
      toast.error(String(e))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="px-4 py-3 bg-slate-950/40 border-t border-slate-700/50 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
            <Scale className="h-3.5 w-3.5" />
            Opening Balances — {account.name}
          </span>
          {!adding && (
            <Button variant="ghost" size="sm" onClick={() => { setAdding(true); setForm(emptyBalanceForm()) }}>
              <Plus className="h-3.5 w-3.5" />
              Add balance
            </Button>
          )}
        </div>

        {adding && (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input
                label="Effective date *"
                type="date"
                value={form.effective_date}
                onChange={(e) => setForm((f) => ({ ...f, effective_date: e.target.value }))}
              />
              <Input
                label={`Amount (${account.currency}) *`}
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0.00"
              />
              <Input
                label="Notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAdding(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleAdd} loading={saving}>Save</Button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-xs text-slate-500">Loading...</p>
        ) : balances.length === 0 && !adding ? (
          <p className="text-xs text-slate-500">No opening balances set for this account.</p>
        ) : balances.length > 0 ? (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="text-left py-1.5 px-2 text-slate-400 font-medium">Date</th>
                <th className="text-right py-1.5 px-2 text-slate-400 font-medium">Amount</th>
                <th className="text-left py-1.5 px-2 text-slate-400 font-medium">Notes</th>
                <th className="w-16 py-1.5 px-2" />
              </tr>
            </thead>
            <tbody>
              {balances.map((b) => {
                const isEditing = editingId === b.id
                return (
                  <tr key={b.id} className="border-b border-slate-700/30 last:border-0">
                    <td className="py-1.5 px-2 text-slate-300">
                      {isEditing ? (
                        <Input type="date" value={draftBalance.effective_date} onChange={(e) => setDraftBalance((d) => ({ ...d, effective_date: e.target.value }))} />
                      ) : (
                        b.effective_date
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-right text-slate-200 font-mono">
                      {isEditing ? (
                        <Input type="number" min="0" step="0.01" value={draftBalance.amount} onChange={(e) => setDraftBalance((d) => ({ ...d, amount: e.target.value }))} />
                      ) : (
                        `${b.currency} ${Number(b.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-slate-400">
                      {isEditing ? (
                        <Input value={draftBalance.notes} onChange={(e) => setDraftBalance((d) => ({ ...d, notes: e.target.value }))} placeholder="Notes" />
                      ) : (
                        b.notes ?? '—'
                      )}
                    </td>
                    <td className="py-1.5 px-2">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => saveEdit(b.id)} disabled={editSaving} className="text-emerald-400 hover:text-emerald-300">
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} disabled={editSaving}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => startEdit(b)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmDelete({ open: true, balance: b })} className="text-red-400 hover:text-red-300">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false, balance: null })}
        onConfirm={handleDelete}
        title="Delete Opening Balance"
        message={`Delete the opening balance dated ${confirmDelete.balance?.effective_date ?? ''}?`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </>
  )
}

export function AccountsSection({ districtId }: { districtId: string }) {
  const { data: accounts, loading, add, update, remove } = useAccounts({ district_id: districtId })
  const { data: currencies } = useCurrencies()
  const toast = useToast()

  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newAccount, setNewAccount] = useState<AccountFormState>(emptyAccountForm)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [draftAccount, setDraftAccount] = useState<AccountFormState>(emptyAccountForm)

  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null)

  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; account: Account | null }>({
    open: false,
    account: null,
  })
  const [deleting, setDeleting] = useState(false)

  const validateAccount = (form: AccountFormState) => {
    if (!form.name.trim()) {
      toast.error('Account name is required')
      return false
    }

    return true
  }

  const handleAdd = async () => {
    if (!validateAccount(newAccount)) return

    setSaving(true)
    try {
      await add({
        district_id: districtId,
        name: newAccount.name,
        code: newAccount.code || null,
        type: newAccount.type,
        currency: newAccount.currency,
        status: newAccount.status,
        description: newAccount.description || null,
        sort_order: parseInt(newAccount.sort_order, 10) || 0,
        institution_name: newAccount.institution_name || null,
        institution_account_number: newAccount.institution_account_number || null,
      })
      setNewAccount(emptyAccountForm)
      setAdding(false)
      toast.success('Account added')
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (account: Account) => {
    setEditingId(account.id)
    setDraftAccount({
      name: account.name,
      code: account.code ?? '',
      type: account.type,
      currency: account.currency,
      status: account.status,
      description: account.description ?? '',
      sort_order: String(account.sort_order ?? 0),
      institution_name: account.institution_name ?? '',
      institution_account_number: account.institution_account_number ?? '',
    })
  }

  const saveEdit = async (accountId: string) => {
    if (!validateAccount(draftAccount)) return

    setEditSaving(true)
    try {
      await update(accountId, {
        name: draftAccount.name,
        code: draftAccount.code || null,
        type: draftAccount.type,
        currency: draftAccount.currency,
        status: draftAccount.status,
        description: draftAccount.description || null,
        sort_order: parseInt(draftAccount.sort_order, 10) || 0,
        institution_name: draftAccount.institution_name || null,
        institution_account_number: draftAccount.institution_account_number || null,
      })
      setEditingId(null)
      toast.success('Account updated')
    } catch (e) {
      toast.error(String(e))
    } finally {
      setEditSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete.account) return
    setDeleting(true)
    try {
      await remove(confirmDelete.account.id)
      setConfirmDelete({ open: false, account: null })
      toast.success('Account deleted')
    } catch (e) {
      toast.error(String(e))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-semibold text-slate-100 flex items-center gap-2">
              <Landmark className="h-5 w-5 text-cyan-400" />
              Accounts
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Track where money sits before the cashbook register arrives: cash box, bank account, mobile wallet, or petty cash.
            </p>
          </div>
          {!adding && (
            <Button variant="ghost" size="sm" onClick={() => { setAdding(true); setNewAccount(emptyAccountForm) }}>
              <Plus className="h-4 w-4" />
              Add account
            </Button>
          )}
        </div>

        {adding && (
          <div className="px-5 py-4 border-b border-slate-700 bg-slate-900/40 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <Input
                label="Account name *"
                value={newAccount.name}
                onChange={(e) => setNewAccount((current) => ({ ...current, name: e.target.value }))}
                placeholder="e.g. Main Cash Box"
              />
              <Input
                label="Code"
                value={newAccount.code}
                onChange={(e) => setNewAccount((current) => ({ ...current, code: e.target.value }))}
                placeholder="Optional short code"
              />
              <Select
                label="Type"
                value={newAccount.type}
                onChange={(e) => setNewAccount((current) => ({ ...current, type: e.target.value as AccountType }))}
                options={Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
              />
              <Select
                label="Currency"
                value={newAccount.currency}
                onChange={(e) => setNewAccount((current) => ({ ...current, currency: e.target.value as Currency }))}
                options={currencies.map((c) => ({ value: c.code, label: `${c.code} - ${c.name}` }))}
              />
              <Select
                label="Status"
                value={newAccount.status}
                onChange={(e) => setNewAccount((current) => ({ ...current, status: e.target.value as AccountStatus }))}
                options={Object.entries(ACCOUNT_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
              />
              <Input
                label="Description"
                value={newAccount.description}
                onChange={(e) => setNewAccount((current) => ({ ...current, description: e.target.value }))}
                placeholder="Optional notes about this account"
              />
              <Input
                label="Sort order"
                type="number"
                min="0"
                value={newAccount.sort_order}
                onChange={(e) => setNewAccount((current) => ({ ...current, sort_order: e.target.value }))}
                placeholder="0"
              />
              {(newAccount.type === 'bank' || newAccount.type === 'savings' || newAccount.type === 'mobile_money') && (
                <>
                  <Input
                    label="Institution name"
                    value={newAccount.institution_name}
                    onChange={(e) => setNewAccount((current) => ({ ...current, institution_name: e.target.value }))}
                    placeholder="e.g. FNB, Econet"
                  />
                  <Input
                    label="Account number"
                    value={newAccount.institution_account_number}
                    onChange={(e) => setNewAccount((current) => ({ ...current, institution_account_number: e.target.value }))}
                    placeholder="Optional"
                  />
                </>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAdding(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleAdd} loading={saving}>
                Save account
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="px-5 py-8 text-sm text-slate-500">Loading accounts...</div>
        ) : accounts.length === 0 ? (
          <div className="px-5 py-8 text-sm text-slate-500">No accounts yet. Add the cash boxes, bank accounts, and wallets this district uses.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Name</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Type</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Currency</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                  <th className="w-36 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => {
                  const isEditing = editingId === account.id
                  const isExpanded = expandedAccountId === account.id
                  return (
                    <>
                    <tr key={account.id} className={`border-b ${isExpanded ? 'border-slate-700/0' : 'border-slate-700/50 last:border-0'} ${isEditing ? 'bg-slate-900/40' : ''}`}>
                      <td className="px-4 py-3 align-top min-w-[220px]">
                        {isEditing ? (
                          <div className="space-y-3">
                            <Input
                              value={draftAccount.name}
                              onChange={(e) => setDraftAccount((current) => ({ ...current, name: e.target.value }))}
                              placeholder="Account name"
                            />
                            <div className="grid grid-cols-1 gap-3">
                              <Input
                                value={draftAccount.code}
                                onChange={(e) => setDraftAccount((current) => ({ ...current, code: e.target.value }))}
                                placeholder="Optional code"
                              />
                              <Input
                                value={draftAccount.description}
                                onChange={(e) => setDraftAccount((current) => ({ ...current, description: e.target.value }))}
                                placeholder="Optional description"
                              />
                              {(draftAccount.type === 'bank' || draftAccount.type === 'savings' || draftAccount.type === 'mobile_money') && (
                                <>
                                  <Input
                                    value={draftAccount.institution_name}
                                    onChange={(e) => setDraftAccount((current) => ({ ...current, institution_name: e.target.value }))}
                                    placeholder="Institution name"
                                  />
                                  <Input
                                    value={draftAccount.institution_account_number}
                                    onChange={(e) => setDraftAccount((current) => ({ ...current, institution_account_number: e.target.value }))}
                                    placeholder="Account number"
                                  />
                                </>
                              )}
                            </div>
                          </div>
                        ) : (
                          <p className="text-slate-100 font-medium">{account.name}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top min-w-[180px]">
                        {isEditing ? (
                          <Select
                            value={draftAccount.type}
                            onChange={(e) => setDraftAccount((current) => ({ ...current, type: e.target.value as AccountType }))}
                            options={Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
                          />
                        ) : (
                          <Badge variant={account.type === 'bank' ? 'teal' : account.type === 'petty_cash' ? 'yellow' : 'default'}>
                            {ACCOUNT_TYPE_LABELS[account.type]}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top min-w-[120px]">
                        {isEditing ? (
                          <Select
                            value={draftAccount.currency}
                            onChange={(e) => setDraftAccount((current) => ({ ...current, currency: e.target.value as Currency }))}
                            options={currencies.map((c) => ({ value: c.code, label: c.code }))}
                          />
                        ) : (
                          <Badge variant="default">{account.currency}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top min-w-[120px]">
                        {isEditing ? (
                          <Select
                            value={draftAccount.status}
                            onChange={(e) => setDraftAccount((current) => ({ ...current, status: e.target.value as AccountStatus }))}
                            options={Object.entries(ACCOUNT_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
                          />
                        ) : (
                          <Badge variant={account.status === 'active' ? 'green' : 'yellow'}>
                            {ACCOUNT_STATUS_LABELS[account.status]}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => saveEdit(account.id)} disabled={editSaving} className="text-emerald-400 hover:text-emerald-300">
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} disabled={editSaving}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setExpandedAccountId(isExpanded ? null : account.id)}
                              title={isExpanded ? 'Hide opening balances' : 'Show opening balances'}
                              className={isExpanded ? 'text-cyan-400' : 'text-slate-400'}
                            >
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => startEdit(account)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete({ open: true, account })} className="text-red-400 hover:text-red-300">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${account.id}-balances`} className="border-b border-slate-700/50 last:border-0">
                        <td colSpan={5} className="p-0">
                          <AccountOpeningBalancesPanel account={account} districtId={districtId} />
                        </td>
                      </tr>
                    )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false, account: null })}
        onConfirm={handleDelete}
        title="Delete Account"
        message={`Delete "${confirmDelete.account?.name ?? ''}"? Once transactions point to an account, archive it instead of deleting it.`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </>
  )
}

export function FundsSection({ districtId }: { districtId: string }) {
  const { data: funds, loading, add, update, remove } = useFunds({ district_id: districtId })
  const toast = useToast()

  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newFund, setNewFund] = useState<FundFormState>(emptyFundForm)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [draftFund, setDraftFund] = useState<FundFormState>(emptyFundForm)

  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; fund: Fund | null }>({
    open: false,
    fund: null,
  })
  const [deleting, setDeleting] = useState(false)

  const handleAdd = async () => {
    if (!newFund.name.trim()) {
      toast.error('Fund name is required')
      return
    }

    setSaving(true)
    try {
      await add({
        district_id: districtId,
        name: newFund.name,
        code: newFund.code || null,
        description: newFund.description || null,
        is_restricted: newFund.is_restricted,
        nature: newFund.nature,
        is_active: newFund.is_active,
        requires_individual_source: newFund.requires_individual_source,
      })
      setNewFund(emptyFundForm)
      setAdding(false)
      toast.success('Fund added')
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (fund: Fund) => {
    setEditingId(fund.id)
    setDraftFund({
      name: fund.name,
      code: fund.code ?? '',
      description: fund.description ?? '',
      is_restricted: fund.is_restricted,
      nature: fund.nature ?? 'mixed',
      is_active: fund.is_active ?? true,
      requires_individual_source: fund.requires_individual_source ?? false,
    })
  }

  const saveEdit = async (fundId: string) => {
    if (!draftFund.name.trim()) {
      toast.error('Fund name is required')
      return
    }

    setEditSaving(true)
    try {
      await update(fundId, {
        name: draftFund.name,
        code: draftFund.code || null,
        description: draftFund.description || null,
        is_restricted: draftFund.is_restricted,
        nature: draftFund.nature,
        is_active: draftFund.is_active,
        requires_individual_source: draftFund.requires_individual_source,
      })
      setEditingId(null)
      toast.success('Fund updated')
    } catch (e) {
      toast.error(String(e))
    } finally {
      setEditSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete.fund) return
    setDeleting(true)
    try {
      await remove(confirmDelete.fund.id)
      setConfirmDelete({ open: false, fund: null })
      toast.success('Fund deleted')
    } catch (e) {
      toast.error(String(e))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-semibold text-slate-100 flex items-center gap-2">
              <PiggyBank className="h-5 w-5 text-cyan-400" />
              Funds
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Organise money by purpose. Every district gets a General Fund automatically.
            </p>
          </div>
          {!adding && (
            <Button variant="ghost" size="sm" onClick={() => { setAdding(true); setNewFund(emptyFundForm) }}>
              <Plus className="h-4 w-4" />
              Add fund
            </Button>
          )}
        </div>

        {adding && (
          <div className="px-5 py-4 border-b border-slate-700 bg-slate-900/40 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <Input
                label="Fund name *"
                value={newFund.name}
                onChange={(e) => setNewFund((current) => ({ ...current, name: e.target.value }))}
                placeholder="e.g. Building Fund"
              />
              <Input
                label="Code"
                value={newFund.code}
                onChange={(e) => setNewFund((current) => ({ ...current, code: e.target.value }))}
                placeholder="Optional short code"
              />
              <Select
                label="Nature"
                value={newFund.nature}
                onChange={(e) => setNewFund((current) => ({ ...current, nature: e.target.value as FundNature }))}
                options={Object.entries(FUND_NATURE_LABELS).map(([value, label]) => ({ value, label }))}
              />
              <Input
                label="Description"
                value={newFund.description}
                onChange={(e) => setNewFund((current) => ({ ...current, description: e.target.value }))}
                placeholder="Optional notes about how this fund is used"
              />
              <div className="flex flex-col gap-2 pt-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newFund.is_restricted}
                    onChange={(e) => setNewFund((current) => ({ ...current, is_restricted: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                  />
                  <span className="text-sm text-slate-200">Restricted fund</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newFund.requires_individual_source}
                    onChange={(e) => setNewFund((current) => ({ ...current, requires_individual_source: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                  />
                  <span className="text-sm text-slate-200">Requires individual source</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAdding(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleAdd} loading={saving}>
                Save fund
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="px-5 py-8 text-sm text-slate-500">Loading funds...</div>
        ) : funds.length === 0 ? (
          <div className="px-5 py-8 text-sm text-slate-500">No funds yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Name</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Description</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Type</th>
                  <th className="w-28 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {funds.map((fund) => {
                  const isEditing = editingId === fund.id
                  return (
                    <tr key={fund.id} className={`border-b border-slate-700/50 last:border-0 ${isEditing ? 'bg-slate-900/40' : ''}`}>
                      <td className="px-4 py-3 align-top min-w-[220px]">
                        {isEditing ? (
                          <div className="space-y-2">
                            <Input
                              value={draftFund.name}
                              onChange={(e) => setDraftFund((current) => ({ ...current, name: e.target.value }))}
                              placeholder="Fund name"
                            />
                            <Input
                              value={draftFund.code}
                              onChange={(e) => setDraftFund((current) => ({ ...current, code: e.target.value }))}
                              placeholder="Code (optional)"
                            />
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <p className="text-slate-100 font-medium">{fund.name}</p>
                            {fund.code && <p className="text-xs text-slate-500 font-mono">{fund.code}</p>}
                            {fund.name.toLowerCase() === 'general fund' && (
                              <p className="text-xs text-slate-500">Default fund used for uncategorised finance activity.</p>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top min-w-[260px]">
                        {isEditing ? (
                          <Input
                            value={draftFund.description}
                            onChange={(e) => setDraftFund((current) => ({ ...current, description: e.target.value }))}
                            placeholder="Optional description"
                          />
                        ) : (
                          <span className={fund.description ? 'text-slate-300' : 'text-slate-500'}>
                            {fund.description ?? 'No description'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top min-w-[180px]">
                        {isEditing ? (
                          <div className="space-y-2">
                            <Select
                              value={draftFund.nature}
                              onChange={(e) => setDraftFund((current) => ({ ...current, nature: e.target.value as FundNature }))}
                              options={Object.entries(FUND_NATURE_LABELS).map(([value, label]) => ({ value, label }))}
                            />
                            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={draftFund.is_restricted}
                                onChange={(e) => setDraftFund((current) => ({ ...current, is_restricted: e.target.checked }))}
                                className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                              />
                              Restricted
                            </label>
                            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={draftFund.requires_individual_source}
                                onChange={(e) => setDraftFund((current) => ({ ...current, requires_individual_source: e.target.checked }))}
                                className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                              />
                              Indiv. source required
                            </label>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <Badge variant={fund.is_restricted ? 'yellow' : 'teal'}>
                              {fund.is_restricted ? 'Restricted' : 'Open use'}
                            </Badge>
                            {fund.nature !== 'mixed' && (
                              <Badge variant="default">{FUND_NATURE_LABELS[fund.nature]}</Badge>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => saveEdit(fund.id)} disabled={editSaving} className="text-emerald-400 hover:text-emerald-300">
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} disabled={editSaving}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => startEdit(fund)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete({ open: true, fund })} className="text-red-400 hover:text-red-300">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false, fund: null })}
        onConfirm={handleDelete}
        title="Delete Fund"
        message={`Delete "${confirmDelete.fund?.name ?? ''}"? Transactions and budgets linked to it will remain, but the fund reference will be cleared.`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </>
  )
}


function DangerZone() {
  return (
    <div className="bg-red-950/30 border border-red-800/50 rounded-xl p-5 space-y-4">
      <h2 className="font-semibold text-red-400 flex items-center gap-2">
        <Trash2 className="h-5 w-5" />
        Danger Zone
      </h2>

      <div className="flex items-start gap-3">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-400" />
        <div>
          <p className="text-sm text-slate-300 font-medium">District deletion is disabled</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Once a district holds financial records it cannot be deleted. To retire a district, contact a platform administrator to deactivate it.
          </p>
        </div>
      </div>
    </div>
  )
}

export function SettingsPanel() {
  const { districtId, isAdmin } = useAuth()

  return (
    <div className="space-y-6">
      {!districtId && (
        <SelectDistrictHint description="Choose a district from the top bar to manage district settings." />
      )}

      {isAdmin && districtId && <DistrictSettings key={`ds-${districtId}`} districtId={districtId} />}

      {isAdmin && <DangerZone />}
    </div>
  )
}
