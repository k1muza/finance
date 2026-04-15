'use client'

import { useEffect, useState } from 'react'
import { useIncome } from '@/hooks/useIncome'
import { useAccounts } from '@/hooks/useAccounts'
import { useDistricts } from '@/hooks/useDistricts'
import { useFunds } from '@/hooks/useFunds'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { PageSpinner } from '@/components/ui/Spinner'
import { SelectDistrictHint } from '@/components/layout/SelectDistrictHint'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { Search, PlusCircle, Pencil, Check, X, Trash2, Settings2, Upload, FileText, Landmark } from 'lucide-react'
import { Currency, Income, PaymentMethod, CURRENCY_SYMBOLS, PAYMENT_METHOD_LABELS } from '@/types'
import { useCategories } from '@/hooks/useCategories'
import { CategoryManagerModal } from '@/components/expenses/CategoryManagerModal'

const today = () => new Date().toISOString().split('T')[0]

interface AddForm {
  account_id: string
  fund_id: string
  description: string
  amount: string
  date: string
  category: string
  currency: Currency
  payment_method: PaymentMethod
}

interface DraftRow {
  account_id: string
  fund_id: string
  description: string
  amount: string
  date: string
  category: string
  currency: Currency
  payment_method: PaymentMethod
}

const createEmptyForm = (): AddForm => ({
  account_id: '',
  fund_id: '',
  description: '',
  amount: '',
  date: today(),
  category: '',
  currency: 'USD',
  payment_method: 'cash',
})

export default function IncomePage() {
  const { districtId } = useAuth()

  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<AddForm>(createEmptyForm)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<DraftRow>({
    account_id: '',
    fund_id: '',
    description: '',
    amount: '',
    date: '',
    category: '',
    currency: 'USD',
    payment_method: 'cash',
  })
  const [editSaving, setEditSaving] = useState(false)

  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string; label: string }>({
    open: false,
    id: '',
    label: '',
  })
  const [deleting, setDeleting] = useState(false)

  const [importing, setImporting] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null)
  const [categoriesOpen, setCategoriesOpen] = useState(false)

  const { data: income, loading, totalsByCurrency, add, update, remove, refresh } = useIncome({
    district_id: districtId ?? null,
    search: search || undefined,
  })
  const { data: accounts } = useAccounts({ district_id: districtId ?? null })
  const { data: districts } = useDistricts()
  const { data: funds } = useFunds({ district_id: districtId ?? null })
  const { data: categoryList } = useCategories('income_categories')

  const toast = useToast()

  const selectedDistrictName = districtId
    ? (districts.find((district) => district.id === districtId)?.name ?? 'Selected district')
    : 'Selected district'

  const activeAccounts = accounts.filter((account) => account.status === 'active')
  const defaultAccountId = activeAccounts[0]?.id ?? ''
  const defaultFundId = funds.find((fund) => fund.name.toLowerCase() === 'general fund')?.id
    ?? funds[0]?.id
    ?? ''

  useEffect(() => {
    setAdding(false)
    setEditingId(null)
    setForm(createEmptyForm())
    setFormErrors({})
    setImporting(false)
    setImportFile(null)
    setImportResult(null)
  }, [districtId])

  const openAddForm = () => {
    setForm({
      ...createEmptyForm(),
      account_id: defaultAccountId,
      fund_id: defaultFundId,
    })
    setFormErrors({})
    setAdding(true)
  }

  const setField = (field: keyof AddForm, value: string) =>
    setForm((current) => ({ ...current, [field]: value }))

  const validateForm = () => {
    const errors: Record<string, string> = {}
    if (!form.account_id) errors.account_id = activeAccounts.length === 0 ? 'Add an active account first' : 'Select an account'
    if (!form.description.trim()) errors.description = 'Description is required'
    const amount = parseFloat(form.amount)
    if (!form.amount || isNaN(amount) || amount <= 0) errors.amount = 'Enter a valid amount'
    if (!form.date) errors.date = 'Date is required'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleAdd = async () => {
    if (!validateForm()) return
    if (!districtId) {
      toast.error('Select a district before saving income.')
      return
    }

    setSaving(true)
    try {
      await add({
        district_id: districtId,
        account_id: form.account_id || null,
        fund_id: form.fund_id || null,
        description: form.description.trim(),
        amount: parseFloat(form.amount),
        date: form.date,
        category: form.category || null,
        currency: form.currency,
        payment_method: form.payment_method,
      })
      setForm({
        ...createEmptyForm(),
        account_id: defaultAccountId,
        fund_id: defaultFundId,
      })
      setAdding(false)
      toast.success('Income recorded')
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (entry: Income) => {
    setEditingId(entry.id)
    setDraft({
      account_id: entry.account_id ?? defaultAccountId,
      fund_id: entry.fund_id ?? defaultFundId,
      description: entry.description,
      amount: String(entry.amount),
      date: entry.date,
      category: entry.category ?? '',
      currency: entry.currency,
      payment_method: entry.payment_method,
    })
  }

  const cancelEdit = () => setEditingId(null)

  const saveEdit = async (entry: Income) => {
    if (!draft.account_id) { toast.error('Select an account'); return }
    if (!draft.description.trim()) { toast.error('Description is required'); return }
    const amount = parseFloat(draft.amount)
    if (!draft.amount || isNaN(amount) || amount <= 0) { toast.error('Enter a valid amount'); return }
    if (!draft.date) { toast.error('Date is required'); return }
    setEditSaving(true)
    try {
      await update(entry.id, {
        account_id: draft.account_id || null,
        fund_id: draft.fund_id || null,
        description: draft.description.trim(),
        amount,
        date: draft.date,
        category: draft.category || null,
        currency: draft.currency,
        payment_method: draft.payment_method,
      })
      setEditingId(null)
      toast.success('Saved')
    } catch (e) {
      toast.error(String(e))
    } finally {
      setEditSaving(false)
    }
  }

  const handleImport = async () => {
    if (!importFile || !districtId) return
    setImportLoading(true)
    setImportResult(null)
    try {
      const fd = new FormData()
      fd.append('file', importFile)
      fd.append('district_id', districtId)
      const res = await fetch('/api/import/income', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Import failed')
      setImportResult({ imported: json.imported, errors: json.errors ?? [] })
      if (json.imported > 0) {
        await refresh()
        toast.success(`${json.imported} income entr${json.imported === 1 ? 'y' : 'ies'} imported`)
      }
    } catch (e) {
      toast.error(String(e))
    } finally {
      setImportLoading(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await remove(confirmDelete.id)
      setConfirmDelete({ open: false, id: '', label: '' })
      toast.success('Income deleted')
    } catch (e) {
      toast.error(String(e))
    } finally {
      setDeleting(false)
    }
  }

  const inputCls = 'w-full rounded-md bg-slate-900 border border-slate-600 px-2 py-1 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500'

  if (!districtId) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Income</h1>
          <p className="text-sm text-slate-400 mt-1">
            Select a district in the top bar to manage district income.
          </p>
        </div>
        <SelectDistrictHint description="Choose a district from the top bar to view, import, and record income." />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Income</h1>
          <p className="text-sm text-slate-400 mt-1">
            Record incoming funds for {selectedDistrictName.toLowerCase()}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => setCategoriesOpen(true)}>
            <Settings2 className="h-4 w-4" /> Categories
          </Button>
          <Button variant="ghost" onClick={() => { setImporting(true); setImportResult(null); setImportFile(null) }}>
            <Upload className="h-4 w-4" /> Import CSV
          </Button>
          {!adding && (
            <Button onClick={openAddForm}>
              <PlusCircle className="h-4 w-4" /> Add Income
            </Button>
          )}
        </div>
      </div>

      {activeAccounts.length === 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          Add at least one active account in Accounts before recording income. Imported rows will also require an account unless the district has exactly one active account.
        </div>
      )}

      {adding && (
        <div className="bg-slate-800 border border-cyan-500/30 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300">New Income Entry</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-8 gap-4">
            <div className="xl:col-span-2">
              <Input
                label="Description *"
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                placeholder="e.g. Monthly dues, Sponsorship, Donation"
                error={formErrors.description}
              />
            </div>
            <Select
              label="Account *"
              value={form.account_id}
              onChange={(e) => setField('account_id', e.target.value)}
              placeholder={activeAccounts.length === 0 ? 'Add an active account first' : 'Select account'}
              options={activeAccounts.map((account) => ({
                value: account.id,
                label: `${account.name} (${account.currency})`,
              }))}
              error={formErrors.account_id}
              disabled={activeAccounts.length === 0}
            />
            <Select
              label="Fund"
              value={form.fund_id}
              onChange={(e) => setField('fund_id', e.target.value)}
              placeholder="Unassigned fund"
              options={funds.map((fund) => ({
                value: fund.id,
                label: `${fund.name}${fund.is_restricted ? ' (Restricted)' : ''}`,
              }))}
            />
            <Select
              label="Category"
              value={form.category}
              onChange={(e) => setField('category', e.target.value)}
              placeholder="Uncategorised"
              options={categoryList.map((category) => ({ value: category.name, label: category.name }))}
            />
            <Select
              label="Currency"
              value={form.currency}
              onChange={(e) => setField('currency', e.target.value)}
              options={[
                { value: 'USD', label: 'USD - US Dollar' },
                { value: 'ZAR', label: 'ZAR - Rand' },
                { value: 'ZWG', label: 'ZWG - Zimbabwe Gold' },
              ]}
            />
            <Select
              label="Payment"
              value={form.payment_method}
              onChange={(e) => setField('payment_method', e.target.value)}
              options={[
                { value: 'cash', label: 'Cash' },
                { value: 'bank', label: 'Bank Transfer' },
                { value: 'ecocash', label: 'EcoCash' },
              ]}
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-300">Amount ({form.currency}) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                  {CURRENCY_SYMBOLS[form.currency]}
                </span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setField('amount', e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 pl-7 pr-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              {formErrors.amount && <p className="text-xs text-red-400">{formErrors.amount}</p>}
            </div>
          </div>
          <div className="flex items-end gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-300">Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setField('date', e.target.value)}
                className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              {formErrors.date && <p className="text-xs text-red-400">{formErrors.date}</p>}
            </div>
            <div className="flex gap-2 pb-0.5">
              <Button variant="ghost" onClick={() => { setAdding(false); setFormErrors({}) }} disabled={saving}>Cancel</Button>
              <Button onClick={handleAdd} loading={saving}>Save Income</Button>
            </div>
          </div>
        </div>
      )}

      <Modal
        open={importing}
        onClose={() => { setImporting(false); setImportFile(null); setImportResult(null) }}
        title="Import Income from CSV"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-400">
            CSV columns: <span className="text-slate-300 font-mono">district, account, fund, description, amount, date, category, currency, payment_method</span>
            <span> - the active district from the top bar is used when the district column is omitted.</span>
            <span> account is required unless the district has exactly one active account.</span>
            <span> currency: USD, ZAR, or ZWG (optional, defaults to USD). payment_method: cash, bank, or ecocash (optional, defaults to cash).</span>
          </p>
          <label className="flex items-center gap-2 cursor-pointer bg-slate-800 border border-slate-700 hover:border-cyan-500/50 transition rounded-lg px-4 py-2 text-sm text-slate-300">
            <FileText className="h-4 w-4 text-slate-400 shrink-0" />
            <span className="truncate">{importFile ? importFile.name : 'Choose CSV file...'}</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => { setImportFile(e.target.files?.[0] ?? null); setImportResult(null) }}
            />
          </label>
          {importResult && (
            <div className="space-y-2">
              {importResult.imported > 0 && (
                <p className="text-xs text-emerald-400">
                  {importResult.imported} income entr{importResult.imported === 1 ? 'y' : 'ies'} imported successfully.
                </p>
              )}
              {importResult.errors.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 space-y-1">
                  <p className="text-xs font-medium text-red-400">{importResult.errors.length} row{importResult.errors.length !== 1 ? 's' : ''} skipped:</p>
                  <ul className="space-y-0.5">
                    {importResult.errors.map((err, i) => (
                      <li key={i} className="text-xs text-red-300">{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => { setImporting(false); setImportFile(null); setImportResult(null) }} disabled={importLoading}>
              Cancel
            </Button>
            <Button onClick={handleImport} loading={importLoading} disabled={!importFile || importLoading}>
              Import
            </Button>
          </div>
        </div>
      </Modal>

      <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 max-w-sm">
        <Search className="h-4 w-4 text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Search description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none flex-1"
        />
      </div>

      {loading ? (
        <PageSpinner />
      ) : (
        <div className="space-y-6">
          {income.length === 0 ? (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
              <p className="text-slate-500">No income recorded yet.</p>
            </div>
          ) : (
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left px-4 py-3 text-slate-400 font-medium">Date</th>
                      <th className="text-left px-4 py-3 text-slate-400 font-medium">Description</th>
                      <th className="text-left px-4 py-3 text-slate-400 font-medium">Account</th>
                      <th className="text-left px-4 py-3 text-slate-400 font-medium">Fund</th>
                      <th className="text-left px-4 py-3 text-slate-400 font-medium">Category</th>
                      <th className="text-left px-4 py-3 text-slate-400 font-medium">Currency</th>
                      <th className="text-left px-4 py-3 text-slate-400 font-medium">Payment</th>
                      <th className="text-right px-4 py-3 text-slate-400 font-medium">Amount</th>
                      <th className="px-4 py-3 w-20" />
                    </tr>
                  </thead>
                  <tbody>
                    {income.map((entry) => {
                      const isEditing = editingId === entry.id
                      return (
                        <tr key={entry.id} className={`border-b border-slate-700/50 last:border-0 transition ${isEditing ? 'bg-slate-700/40' : 'hover:bg-slate-700/30'}`}>
                          <td className="px-4 py-2 text-slate-300 whitespace-nowrap min-w-[130px]">
                            {isEditing ? (
                              <input type="date" className={inputCls} value={draft.date} onChange={(ev) => setDraft((current) => ({ ...current, date: ev.target.value }))} />
                            ) : (
                              new Date(entry.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                            )}
                          </td>
                          <td className="px-4 py-2 text-slate-100 min-w-[180px]">
                            {isEditing ? (
                              <input className={inputCls} value={draft.description} onChange={(ev) => setDraft((current) => ({ ...current, description: ev.target.value }))} autoFocus />
                            ) : (
                              <button type="button" onClick={() => startEdit(entry)} className="hover:text-cyan-400 transition text-left">{entry.description}</button>
                            )}
                          </td>
                          <td className="px-4 py-2 text-slate-400 min-w-[190px]">
                            {isEditing ? (
                              <select className={inputCls} value={draft.account_id} onChange={(ev) => setDraft((current) => ({ ...current, account_id: ev.target.value }))}>
                                <option value="">Select account</option>
                                {accounts.map((account) => (
                                  <option key={account.id} value={account.id}>
                                    {account.name}{account.status === 'archived' ? ' (Archived)' : ''} - {account.currency}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className={entry.account?.name ? 'text-slate-300' : 'text-slate-600'}>
                                {entry.account?.name ?? 'Unassigned'}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-slate-400 min-w-[170px]">
                            {isEditing ? (
                              <select className={inputCls} value={draft.fund_id} onChange={(ev) => setDraft((current) => ({ ...current, fund_id: ev.target.value }))}>
                                <option value="">Unassigned fund</option>
                                {funds.map((fund) => <option key={fund.id} value={fund.id}>{fund.name}</option>)}
                              </select>
                            ) : (
                              <span className={entry.fund?.name ? 'text-slate-300 inline-flex items-center gap-1.5' : 'text-slate-600 inline-flex items-center gap-1.5'}>
                                <Landmark className="h-3.5 w-3.5" />
                                {entry.fund?.name ?? 'Unassigned'}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-slate-400 min-w-[140px]">
                            {isEditing ? (
                              <select className={inputCls} value={draft.category} onChange={(ev) => setDraft((current) => ({ ...current, category: ev.target.value }))}>
                                <option value="">Uncategorised</option>
                                {categoryList.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}
                              </select>
                            ) : (
                              <span className={entry.category ? 'text-slate-300' : 'text-slate-600'}>{entry.category ?? '-'}</span>
                            )}
                          </td>
                          <td className="px-4 py-2 min-w-[90px]">
                            {isEditing ? (
                              <select className={inputCls} value={draft.currency} onChange={(ev) => setDraft((current) => ({ ...current, currency: ev.target.value as Currency }))}>
                                <option value="USD">USD</option>
                                <option value="ZAR">ZAR</option>
                                <option value="ZWG">ZWG</option>
                              </select>
                            ) : (
                              <span className="text-xs font-medium text-slate-400 bg-slate-700 px-1.5 py-0.5 rounded">
                                {entry.currency}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 min-w-[110px]">
                            {isEditing ? (
                              <select className={inputCls} value={draft.payment_method} onChange={(ev) => setDraft((current) => ({ ...current, payment_method: ev.target.value as PaymentMethod }))}>
                                <option value="cash">Cash</option>
                                <option value="bank">Bank</option>
                                <option value="ecocash">EcoCash</option>
                              </select>
                            ) : (
                              <span className="text-slate-400 capitalize">{PAYMENT_METHOD_LABELS[entry.payment_method]}</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right font-semibold text-emerald-400 min-w-[110px]">
                            {isEditing ? (
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                                  {CURRENCY_SYMBOLS[draft.currency]}
                                </span>
                                <input type="number" min="0.01" step="0.01" className={`${inputCls} pl-5 text-right`} value={draft.amount} onChange={(ev) => setDraft((current) => ({ ...current, amount: ev.target.value }))} />
                              </div>
                            ) : formatCurrency(entry.amount, entry.currency)}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            {isEditing ? (
                              <div className="flex items-center gap-1 justify-end">
                                <Button variant="ghost" size="sm" onClick={() => saveEdit(entry)} disabled={editSaving} className="text-emerald-400 hover:text-emerald-300" title="Save"><Check className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={editSaving} title="Cancel"><X className="h-4 w-4" /></Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => startEdit(entry)}><Pencil className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete({ open: true, id: entry.id, label: entry.description })} className="text-red-400 hover:text-red-300" title="Delete"><Trash2 className="h-4 w-4" /></Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-700 bg-slate-900/50">
                      <td colSpan={7} className="px-4 py-3 text-slate-400 text-sm font-medium">
                        {selectedDistrictName} total
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-400 space-y-0.5">
                        {Object.entries(totalsByCurrency).map(([currency, amount]) => (
                          <div key={currency}>{formatCurrency(amount!, currency as Currency)}</div>
                        ))}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false, id: '', label: '' })}
        onConfirm={handleDelete}
        title="Delete Income"
        message={`Delete "${confirmDelete.label}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
      />
      <CategoryManagerModal
        open={categoriesOpen}
        onClose={() => setCategoriesOpen(false)}
        table="income_categories"
        title="Income Categories"
        description="Manage categories used to classify income transactions."
      />
    </div>
  )
}
