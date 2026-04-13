'use client'

import { useState } from 'react'
import { useIncome } from '@/hooks/useIncome'
import { useDistricts } from '@/hooks/useDistricts'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { PageSpinner } from '@/components/ui/Spinner'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { TrendingUp, Search, PlusCircle, Pencil, Check, X, Trash2, Settings2, Upload, FileText } from 'lucide-react'
import { Income } from '@/types'
import { useCategories } from '@/hooks/useCategories'
import { CategoryManagerModal } from '@/components/expenses/CategoryManagerModal'

const today = () => new Date().toISOString().split('T')[0]

interface AddForm {
  district_id: string
  description: string
  amount: string
  date: string
  category: string
}

interface DraftRow {
  description: string
  amount: string
  date: string
  category: string
}

const emptyForm: AddForm = { district_id: '', description: '', amount: '', date: today(), category: '' }

export default function IncomePage() {
  const { districtId, isAdmin, activeDistrictId } = useAuth()
  const needsDistrictPicker = isAdmin && !activeDistrictId
  const showDistrictColumn = isAdmin && !districtId

  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<AddForm>({ ...emptyForm, district_id: districtId ?? '' })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<DraftRow>({ description: '', amount: '', date: '', category: '' })
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

  const { data: income, loading, total, add, update, remove, refresh } = useIncome({
    district_id: districtId ?? undefined,
    search: search || undefined,
  })
  const { data: districts } = useDistricts()
  const { data: categoryList } = useCategories('income_categories')

  const toast = useToast()

  const selectedDistrictName = districtId
    ? (districts.find((d) => d.id === districtId)?.name ?? 'Selected district')
    : 'All districts'

  const setField = (field: keyof AddForm, value: string) =>
    setForm((f) => ({ ...f, [field]: value }))

  const validateForm = () => {
    const e: Record<string, string> = {}
    if (needsDistrictPicker && !form.district_id) e.district_id = 'Select a district'
    if (!form.description.trim()) e.description = 'Description is required'
    const amt = parseFloat(form.amount)
    if (!form.amount || isNaN(amt) || amt <= 0) e.amount = 'Enter a valid amount'
    if (!form.date) e.date = 'Date is required'
    setFormErrors(e)
    return Object.keys(e).length === 0
  }

  const handleAdd = async () => {
    if (!validateForm()) return
    setSaving(true)
    try {
      await add({
        district_id: form.district_id || districtId!,
        description: form.description.trim(),
        amount: parseFloat(form.amount),
        date: form.date,
        category: form.category || null,
      })
      setForm({ ...emptyForm, district_id: districtId ?? '' })
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
      description: entry.description,
      amount: String(entry.amount),
      date: entry.date,
      category: entry.category ?? '',
    })
  }

  const cancelEdit = () => setEditingId(null)

  const saveEdit = async (id: string) => {
    if (!draft.description.trim()) { toast.error('Description is required'); return }
    const amt = parseFloat(draft.amount)
    if (!draft.amount || isNaN(amt) || amt <= 0) { toast.error('Enter a valid amount'); return }
    if (!draft.date) { toast.error('Date is required'); return }
    setEditSaving(true)
    try {
      await update(id, { description: draft.description.trim(), amount: amt, date: draft.date, category: draft.category || null })
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
            <Button onClick={() => { setForm({ ...emptyForm, district_id: districtId ?? '' }); setAdding(true) }}>
              <PlusCircle className="h-4 w-4" /> Add Income
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex items-start gap-4">
          <div className="bg-emerald-500/10 rounded-lg p-3 text-emerald-400 shrink-0">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-slate-400">{districtId ? `${selectedDistrictName} income` : 'Total income'}</p>
            <p className="text-2xl font-bold text-emerald-400 mt-0.5">{formatCurrency(total)}</p>
            <p className="text-xs text-slate-500 mt-1">{income.length} transaction{income.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {adding && (
        <div className="bg-slate-800 border border-cyan-500/30 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300">New Income Entry</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {needsDistrictPicker && (
              <Select
                label="District *"
                value={form.district_id}
                onChange={(e) => setField('district_id', e.target.value)}
                placeholder="Select district"
                options={districts.map((d) => ({ value: d.id, label: d.name }))}
                error={formErrors.district_id}
              />
            )}
            <div className={needsDistrictPicker ? '' : 'lg:col-span-2'}>
              <Input
                label="Description *"
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                placeholder="e.g. Monthly dues, Sponsorship, Donation"
                error={formErrors.description}
              />
            </div>
            <Select
              label="Category"
              value={form.category}
              onChange={(e) => setField('category', e.target.value)}
              placeholder="Uncategorised"
              options={categoryList.map((c) => ({ value: c.name, label: c.name }))}
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
            CSV columns: <span className="text-slate-300 font-mono">district, description, amount, date, category</span>
            {districtId && <span> — district column is optional when a district is already selected.</span>}
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
                      {showDistrictColumn && <th className="text-left px-4 py-3 text-slate-400 font-medium">District</th>}
                      <th className="text-left px-4 py-3 text-slate-400 font-medium">Date</th>
                      <th className="text-left px-4 py-3 text-slate-400 font-medium">Description</th>
                      <th className="text-left px-4 py-3 text-slate-400 font-medium">Category</th>
                      <th className="text-right px-4 py-3 text-slate-400 font-medium">Amount</th>
                      <th className="px-4 py-3 w-20" />
                    </tr>
                  </thead>
                  <tbody>
                    {income.map((entry) => {
                      const isEditing = editingId === entry.id
                      return (
                        <tr key={entry.id} className={`border-b border-slate-700/50 last:border-0 transition ${isEditing ? 'bg-slate-700/40' : 'hover:bg-slate-700/30'}`}>
                          {showDistrictColumn && (
                            <td className="px-4 py-2 text-slate-300 whitespace-nowrap">
                              {entry.district?.name ?? 'Unknown district'}
                            </td>
                          )}
                          <td className="px-4 py-2 text-slate-300 whitespace-nowrap min-w-[130px]">
                            {isEditing ? (
                              <input type="date" className={inputCls} value={draft.date} onChange={(ev) => setDraft((d) => ({ ...d, date: ev.target.value }))} />
                            ) : (
                              new Date(entry.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                            )}
                          </td>
                          <td className="px-4 py-2 text-slate-100 min-w-[180px]">
                            {isEditing ? (
                              <input className={inputCls} value={draft.description} onChange={(ev) => setDraft((d) => ({ ...d, description: ev.target.value }))} autoFocus />
                            ) : (
                              <button type="button" onClick={() => startEdit(entry)} className="hover:text-cyan-400 transition text-left">{entry.description}</button>
                            )}
                          </td>
                          <td className="px-4 py-2 text-slate-400 min-w-[140px]">
                            {isEditing ? (
                              <select className={inputCls} value={draft.category} onChange={(ev) => setDraft((d) => ({ ...d, category: ev.target.value }))}>
                                <option value="">Uncategorised</option>
                                {categoryList.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                              </select>
                            ) : (
                              <span className={entry.category ? 'text-slate-300' : 'text-slate-600'}>{entry.category ?? '-'}</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right font-semibold text-emerald-400 min-w-[110px]">
                            {isEditing ? (
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                                <input type="number" min="0.01" step="0.01" className={`${inputCls} pl-5 text-right`} value={draft.amount} onChange={(ev) => setDraft((d) => ({ ...d, amount: ev.target.value }))} />
                              </div>
                            ) : formatCurrency(entry.amount)}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            {isEditing ? (
                              <div className="flex items-center gap-1 justify-end">
                                <Button variant="ghost" size="sm" onClick={() => saveEdit(entry.id)} disabled={editSaving} className="text-emerald-400 hover:text-emerald-300" title="Save"><Check className="h-4 w-4" /></Button>
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
                      <td colSpan={showDistrictColumn ? 4 : 3} className="px-4 py-3 text-slate-400 text-sm font-medium">
                        {districtId ? `${selectedDistrictName} total` : 'Grand total'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-400">{formatCurrency(total)}</td>
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
