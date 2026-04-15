'use client'

import { useState } from 'react'
import { useExpenses } from '@/hooks/useExpenses'
import { useDistricts } from '@/hooks/useDistricts'
import { useFunds } from '@/hooks/useFunds'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { PageSpinner } from '@/components/ui/Spinner'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { Modal } from '@/components/ui/Modal'
import { PlusCircle, Trash2, TrendingDown, Search, Upload, FileText, Pencil, Check, X, Settings2, Landmark } from 'lucide-react'
import { Expense } from '@/types'
import { useCategories } from '@/hooks/useCategories'
import { CategoryManagerModal } from '@/components/expenses/CategoryManagerModal'

const today = () => new Date().toISOString().split('T')[0]

interface AddForm {
  district_id: string
  fund_id: string
  description: string
  amount: string
  date: string
  category: string
}

interface DraftRow {
  fund_id: string
  description: string
  amount: string
  date: string
  category: string
}

const emptyForm: AddForm = { district_id: '', fund_id: '', description: '', amount: '', date: today(), category: '' }

export default function ExpenditurePage() {
  const { districtId, isAdmin, activeDistrictId } = useAuth()
  const needsDistrictPicker = isAdmin && !activeDistrictId
  const showDistrictColumn = isAdmin && !districtId

  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<AddForm>({ ...emptyForm, district_id: districtId ?? '' })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<DraftRow>({ fund_id: '', description: '', amount: '', date: '', category: '' })
  const [editSaving, setEditSaving] = useState(false)

  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string; label: string }>({
    open: false, id: '', label: '',
  })
  const [deleting, setDeleting] = useState(false)

  const [importing, setImporting] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null)
  const [categoriesOpen, setCategoriesOpen] = useState(false)

  const { data: expenses, loading, total, add, update, remove, refresh } = useExpenses({
    district_id: districtId ?? undefined,
    search: search || undefined,
  })
  const { data: districts } = useDistricts()
  const { data: funds } = useFunds()
  const { data: categoryList } = useCategories('expense_categories')
  const toast = useToast()

  const selectedDistrictName = districtId
    ? (districts.find((district) => district.id === districtId)?.name ?? 'Selected district')
    : 'All districts'

  const fundsForDistrict = (selectedDistrictId: string | null | undefined) =>
    funds.filter((fund) => fund.district_id === selectedDistrictId)

  const defaultFundIdForDistrict = (selectedDistrictId: string | null | undefined) => {
    const fundOptions = fundsForDistrict(selectedDistrictId)
    return fundOptions.find((fund) => fund.name.toLowerCase() === 'general fund')?.id
      ?? fundOptions[0]?.id
      ?? ''
  }

  const openAddForm = () => {
    const nextDistrictId = districtId ?? ''
    setForm({
      ...emptyForm,
      district_id: nextDistrictId,
      fund_id: nextDistrictId ? defaultFundIdForDistrict(nextDistrictId) : '',
    })
    setFormErrors({})
    setAdding(true)
  }

  const handleDistrictChange = (nextDistrictId: string) => {
    setForm((current) => ({
      ...current,
      district_id: nextDistrictId,
      fund_id: defaultFundIdForDistrict(nextDistrictId),
    }))
  }

  const setField = (field: keyof AddForm, value: string) =>
    setForm((current) => ({ ...current, [field]: value }))

  const validateForm = () => {
    const errors: Record<string, string> = {}
    if (needsDistrictPicker && !form.district_id) errors.district_id = 'Select a district'
    if (!form.description.trim()) errors.description = 'Description is required'
    const amount = parseFloat(form.amount)
    if (!form.amount || isNaN(amount) || amount <= 0) errors.amount = 'Enter a valid amount'
    if (!form.date) errors.date = 'Date is required'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleAdd = async () => {
    if (!validateForm()) return
    setSaving(true)
    try {
      const selectedDistrictId = form.district_id || districtId
      if (!selectedDistrictId) throw new Error('Select a district before saving expenditure.')

      await add({
        district_id: selectedDistrictId,
        fund_id: form.fund_id || null,
        description: form.description.trim(),
        amount: parseFloat(form.amount),
        date: form.date,
        category: form.category || null,
      })
      setForm({
        ...emptyForm,
        district_id: districtId ?? '',
        fund_id: districtId ? defaultFundIdForDistrict(districtId) : '',
      })
      setAdding(false)
      toast.success('Expenditure recorded')
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (expense: Expense) => {
    setEditingId(expense.id)
    setDraft({
      fund_id: expense.fund_id ?? defaultFundIdForDistrict(expense.district_id),
      description: expense.description,
      amount: String(expense.amount),
      date: expense.date,
      category: expense.category ?? '',
    })
  }

  const cancelEdit = () => setEditingId(null)

  const saveEdit = async (expense: Expense) => {
    if (!draft.description.trim()) { toast.error('Description is required'); return }
    const amount = parseFloat(draft.amount)
    if (!draft.amount || isNaN(amount) || amount <= 0) { toast.error('Enter a valid amount'); return }
    if (!draft.date) { toast.error('Date is required'); return }
    setEditSaving(true)
    try {
      await update(expense.id, {
        fund_id: draft.fund_id || null,
        description: draft.description.trim(),
        amount,
        date: draft.date,
        category: draft.category || null,
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
    if (!importFile) return
    setImportLoading(true)
    setImportResult(null)
    try {
      const fd = new FormData()
      fd.append('file', importFile)
      if (districtId) fd.append('district_id', districtId)
      const res = await fetch('/api/import/expenses', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Import failed')
      setImportResult({ imported: json.imported, errors: json.errors ?? [] })
      if (json.imported > 0) {
        await refresh()
        toast.success(`${json.imported} expenditure entr${json.imported === 1 ? 'y' : 'ies'} imported`)
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
      toast.success('Expenditure deleted')
    } catch (e) {
      toast.error(String(e))
    } finally {
      setDeleting(false)
    }
  }

  const inputCls = 'w-full rounded-md bg-slate-900 border border-slate-600 px-2 py-1 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500'
  const addFormFunds = fundsForDistrict(form.district_id || districtId)

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Expenditure</h1>
          <p className="text-sm text-slate-400 mt-1">
            Record outgoing transactions for {selectedDistrictName.toLowerCase()}.
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
              <PlusCircle className="h-4 w-4" /> Add Expenditure
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex items-start gap-4">
          <div className="bg-red-500/10 rounded-lg p-3 text-red-400">
            <TrendingDown className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-slate-400">{districtId ? `${selectedDistrictName} expenditure` : 'Total expenditure'}</p>
            <p className="text-2xl font-bold text-red-400 mt-0.5">{formatCurrency(total)}</p>
            <p className="text-xs text-slate-500 mt-1">{expenses.length} transaction{expenses.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {adding && (
        <div className="bg-slate-800 border border-cyan-500/30 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300">New Expenditure</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            {needsDistrictPicker && (
              <Select
                label="District *"
                value={form.district_id}
                onChange={(e) => handleDistrictChange(e.target.value)}
                placeholder="Select district"
                options={districts.map((district) => ({ value: district.id, label: district.name }))}
                error={formErrors.district_id}
              />
            )}
            <div className={needsDistrictPicker ? '' : 'xl:col-span-2'}>
              <Input
                label="Description *"
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                placeholder="e.g. Fuel reimbursement, Venue rent"
                error={formErrors.description}
              />
            </div>
            <Select
              label="Fund"
              value={form.fund_id}
              onChange={(e) => setField('fund_id', e.target.value)}
              placeholder="Unassigned fund"
              options={addFormFunds.map((fund) => ({
                value: fund.id,
                label: `${fund.name}${fund.is_restricted ? ' (Restricted)' : ''}`,
              }))}
              disabled={(form.district_id || districtId) ? false : needsDistrictPicker}
            />
            <Select
              label="Category"
              value={form.category}
              onChange={(e) => setField('category', e.target.value)}
              placeholder="Uncategorised"
              options={categoryList.map((category) => ({ value: category.name, label: category.name }))}
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-300">Amount (USD) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
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
              <Button variant="ghost" onClick={() => { setAdding(false); setFormErrors({}) }} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleAdd} loading={saving}>
                Save Expenditure
              </Button>
            </div>
          </div>
        </div>
      )}

      <Modal
        open={importing}
        onClose={() => { setImporting(false); setImportFile(null); setImportResult(null) }}
        title="Import Expenditure from CSV"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-400">
            CSV columns: <span className="text-slate-300 font-mono">district, fund, description, amount, date, category</span>
            {districtId && <span> — district column is optional when a district is already selected.</span>}
            <span> fund is optional and defaults to General Fund when available.</span>
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
                  {importResult.imported} expenditure entr{importResult.imported === 1 ? 'y' : 'ies'} imported successfully.
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
      ) : expenses.length === 0 ? (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
          <p className="text-slate-500">No expenditure recorded yet.</p>
        </div>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  {showDistrictColumn && <th className="text-left px-4 py-3 text-slate-400 font-medium">District</th>}
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Date</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Description</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Fund</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Category</th>
                  <th className="text-right px-4 py-3 text-slate-400 font-medium">Amount</th>
                  <th className="px-4 py-3 w-20" />
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => {
                  const isEditing = editingId === expense.id
                  const entryFunds = fundsForDistrict(expense.district_id)
                  return (
                    <tr
                      key={expense.id}
                      className={`border-b border-slate-700/50 last:border-0 transition ${isEditing ? 'bg-slate-700/40' : 'hover:bg-slate-700/30'}`}
                    >
                      {showDistrictColumn && (
                        <td className="px-4 py-2 text-slate-300 whitespace-nowrap">
                          {expense.district?.name ?? 'Unknown district'}
                        </td>
                      )}
                      <td className="px-4 py-2 text-slate-300 whitespace-nowrap min-w-[130px]">
                        {isEditing ? (
                          <input
                            type="date"
                            className={inputCls}
                            value={draft.date}
                            onChange={(ev) => setDraft((current) => ({ ...current, date: ev.target.value }))}
                          />
                        ) : (
                          new Date(expense.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                        )}
                      </td>
                      <td className="px-4 py-2 text-slate-100 min-w-[180px]">
                        {isEditing ? (
                          <input
                            className={inputCls}
                            value={draft.description}
                            onChange={(ev) => setDraft((current) => ({ ...current, description: ev.target.value }))}
                            autoFocus
                          />
                        ) : (
                          <button type="button" onClick={() => startEdit(expense)} className="hover:text-cyan-400 transition text-left">
                            {expense.description}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-2 text-slate-400 min-w-[170px]">
                        {isEditing ? (
                          <select className={inputCls} value={draft.fund_id} onChange={(ev) => setDraft((current) => ({ ...current, fund_id: ev.target.value }))}>
                            <option value="">Unassigned fund</option>
                            {entryFunds.map((fund) => <option key={fund.id} value={fund.id}>{fund.name}</option>)}
                          </select>
                        ) : (
                          <span className={expense.fund?.name ? 'text-slate-300 inline-flex items-center gap-1.5' : 'text-slate-600 inline-flex items-center gap-1.5'}>
                            <Landmark className="h-3.5 w-3.5" />
                            {expense.fund?.name ?? 'Unassigned'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-slate-400 min-w-[140px]">
                        {isEditing ? (
                          <select
                            className={inputCls}
                            value={draft.category}
                            onChange={(ev) => setDraft((current) => ({ ...current, category: ev.target.value }))}
                          >
                            <option value="">Uncategorised</option>
                            {categoryList.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}
                          </select>
                        ) : (
                          <span className={expense.category ? 'text-slate-300' : 'text-slate-600'}>
                            {expense.category ?? '-'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right font-semibold text-red-400 min-w-[110px]">
                        {isEditing ? (
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              className={`${inputCls} pl-5 text-right`}
                              value={draft.amount}
                              onChange={(ev) => setDraft((current) => ({ ...current, amount: ev.target.value }))}
                            />
                          </div>
                        ) : (
                          formatCurrency(expense.amount)
                        )}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {isEditing ? (
                          <div className="flex items-center gap-1 justify-end">
                            <Button variant="ghost" size="sm" onClick={() => saveEdit(expense)} disabled={editSaving} className="text-emerald-400 hover:text-emerald-300" title="Save">
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={editSaving} title="Cancel">
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => startEdit(expense)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete({ open: true, id: expense.id, label: expense.description })} className="text-red-400 hover:text-red-300" title="Delete">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-700 bg-slate-900/50">
                  <td colSpan={showDistrictColumn ? 5 : 4} className="px-4 py-3 text-slate-400 text-sm font-medium">
                    {districtId ? `${selectedDistrictName} total` : 'Grand total'}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-red-400">{formatCurrency(total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false, id: '', label: '' })}
        onConfirm={handleDelete}
        title="Delete Expenditure"
        message={`Delete "${confirmDelete.label}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
      />
      <CategoryManagerModal
        open={categoriesOpen}
        onClose={() => setCategoriesOpen(false)}
        table="expense_categories"
        title="Expenditure Categories"
        description="Manage categories used to classify expenditure transactions."
      />
    </div>
  )
}
