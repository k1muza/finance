'use client'

import { useState } from 'react'
import { useDistrictContributions } from '@/hooks/useDistrictContributions'
import { useIncome } from '@/hooks/useIncome'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { PageSpinner } from '@/components/ui/Spinner'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { TrendingUp, Search, PlusCircle, Pencil, Check, X, Trash2, Settings2 } from 'lucide-react'
import { Income } from '@/types'
import { useCategories } from '@/hooks/useCategories'
import { CategoryManagerModal } from '@/components/expenses/CategoryManagerModal'

const today = () => new Date().toISOString().split('T')[0]

interface AddForm {
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

const emptyForm: AddForm = { description: '', amount: '', date: today(), category: '' }

export default function IncomePage() {
  const { districtId } = useAuth()
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<AddForm>(emptyForm)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<DraftRow>({ description: '', amount: '', date: '', category: '' })
  const [editSaving, setEditSaving] = useState(false)

  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string; label: string }>({
    open: false, id: '', label: '',
  })
  const [deleting, setDeleting] = useState(false)
  const [categoriesOpen, setCategoriesOpen] = useState(false)

  const { data: contributions, loading: contribLoading, total: contribTotal } = useDistrictContributions({
    district_id: districtId ?? undefined,
  })
  const { data: manualIncome, loading: incomeLoading, total: manualTotal, add, update, remove } = useIncome({
    district_id: districtId ?? undefined,
    search: search || undefined,
  })
  const { data: categoryList } = useCategories('income_categories')

  const toast = useToast()
  const loading = contribLoading || incomeLoading
  const grandTotal = contribTotal + manualTotal

  const setField = (field: keyof AddForm, value: string) =>
    setForm((f) => ({ ...f, [field]: value }))

  const validateForm = () => {
    const e: Record<string, string> = {}
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
        district_id: districtId!,
        description: form.description.trim(),
        amount: parseFloat(form.amount),
        date: form.date,
        category: form.category || null,
      })
      setForm(emptyForm)
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

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await remove(confirmDelete.id)
      setConfirmDelete({ open: false, id: '', label: '' })
      toast.success('Entry deleted')
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
          <p className="text-sm text-slate-400 mt-1">Contributions from people plus any additional income</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => setCategoriesOpen(true)}>
            <Settings2 className="h-4 w-4" /> Categories
          </Button>
          {!adding && (
            <Button onClick={() => { setForm(emptyForm); setAdding(true) }}>
              <PlusCircle className="h-4 w-4" /> Add Income
            </Button>
          )}
        </div>
      </div>

      {/* Summary card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex items-start gap-4">
          <div className="bg-emerald-500/10 rounded-lg p-3 text-emerald-400 shrink-0">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-slate-400">Total Income</p>
            <p className="text-2xl font-bold text-emerald-400 mt-0.5">{formatCurrency(grandTotal)}</p>
            <p className="text-xs text-slate-500 mt-1">
              {formatCurrency(contribTotal)} contributions · {formatCurrency(manualTotal)} other
            </p>
          </div>
        </div>
      </div>

      {/* Add form */}
      {adding && (
        <div className="bg-slate-800 border border-cyan-500/30 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300">New Income Entry</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <Input
                label="Description *"
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                placeholder="e.g. Sunday offering, Sponsorship"
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
                  type="number" min="0.01" step="0.01"
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
                type="date" value={form.date}
                onChange={(e) => setField('date', e.target.value)}
                className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              {formErrors.date && <p className="text-xs text-red-400">{formErrors.date}</p>}
            </div>
            <div className="flex gap-2 pb-0.5">
              <Button variant="ghost" onClick={() => { setAdding(false); setFormErrors({}) }} disabled={saving}>Cancel</Button>
              <Button onClick={handleAdd} loading={saving}>Save</Button>
            </div>
          </div>
        </div>
      )}

      {/* Search (only filters manual entries) */}
      <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 max-w-sm">
        <Search className="h-4 w-4 text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Search manual entries…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none flex-1"
        />
      </div>

      {loading ? (
        <PageSpinner />
      ) : (
        <div className="space-y-6">
          {/* Manual income */}
          {(manualIncome.length > 0 || search) && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Other Income</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left px-4 py-3 text-slate-400 font-medium">Date</th>
                      <th className="text-left px-4 py-3 text-slate-400 font-medium">Description</th>
                      <th className="text-left px-4 py-3 text-slate-400 font-medium">Category</th>
                      <th className="text-right px-4 py-3 text-slate-400 font-medium">Amount</th>
                      <th className="px-4 py-3 w-20" />
                    </tr>
                  </thead>
                  <tbody>
                    {manualIncome.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-slate-500">No entries match your search.</td>
                      </tr>
                    ) : manualIncome.map((e) => {
                      const isEditing = editingId === e.id
                      return (
                        <tr key={e.id} className={`border-b border-slate-700/50 last:border-0 transition ${isEditing ? 'bg-slate-700/40' : 'hover:bg-slate-700/30'}`}>
                          <td className="px-4 py-2 text-slate-300 whitespace-nowrap min-w-[130px]">
                            {isEditing ? (
                              <input type="date" className={inputCls} value={draft.date} onChange={(ev) => setDraft((d) => ({ ...d, date: ev.target.value }))} />
                            ) : (
                              new Date(e.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                            )}
                          </td>
                          <td className="px-4 py-2 text-slate-100 min-w-[180px]">
                            {isEditing ? (
                              <input className={inputCls} value={draft.description} onChange={(ev) => setDraft((d) => ({ ...d, description: ev.target.value }))} autoFocus />
                            ) : (
                              <button type="button" onClick={() => startEdit(e)} className="hover:text-cyan-400 transition text-left">{e.description}</button>
                            )}
                          </td>
                          <td className="px-4 py-2 text-slate-400 min-w-[140px]">
                            {isEditing ? (
                              <select className={inputCls} value={draft.category} onChange={(ev) => setDraft((d) => ({ ...d, category: ev.target.value }))}>
                                <option value="">Uncategorised</option>
                                {categoryList.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                              </select>
                            ) : (
                              <span className={e.category ? 'text-slate-300' : 'text-slate-600'}>{e.category ?? '—'}</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right font-semibold text-emerald-400 min-w-[110px]">
                            {isEditing ? (
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                                <input type="number" min="0.01" step="0.01" className={`${inputCls} pl-5 text-right`} value={draft.amount} onChange={(ev) => setDraft((d) => ({ ...d, amount: ev.target.value }))} />
                              </div>
                            ) : formatCurrency(e.amount)}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            {isEditing ? (
                              <div className="flex items-center gap-1 justify-end">
                                <Button variant="ghost" size="sm" onClick={() => saveEdit(e.id)} disabled={editSaving} className="text-emerald-400 hover:text-emerald-300" title="Save"><Check className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={editSaving} title="Cancel"><X className="h-4 w-4" /></Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => startEdit(e)}><Pencil className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete({ open: true, id: e.id, label: e.description })} className="text-red-400 hover:text-red-300" title="Delete"><Trash2 className="h-4 w-4" /></Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {manualIncome.length > 0 && (
                    <tfoot>
                      <tr className="border-t border-slate-700 bg-slate-900/50">
                        <td colSpan={3} className="px-4 py-3 text-slate-400 text-sm font-medium">Subtotal</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-400">{formatCurrency(manualTotal)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* Contributions */}
          {contributions.length > 0 && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">People&apos;s Contributions</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left px-4 py-3 text-slate-400 font-medium">Date</th>
                      <th className="text-left px-4 py-3 text-slate-400 font-medium">Person</th>
                      <th className="text-left px-4 py-3 text-slate-400 font-medium">Note</th>
                      <th className="text-right px-4 py-3 text-slate-400 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contributions.map((c) => (
                      <tr key={c.id} className="border-b border-slate-700/50 last:border-0 hover:bg-slate-700/30 transition">
                        <td className="px-4 py-2.5 text-slate-300 whitespace-nowrap">
                          {new Date(c.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-2.5 text-slate-100">{c.person_name}</td>
                        <td className="px-4 py-2.5 text-slate-400">{c.note ?? '—'}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-emerald-400">{formatCurrency(c.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-700 bg-slate-900/50">
                      <td colSpan={3} className="px-4 py-3 text-slate-400 text-sm font-medium">Subtotal</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-400">{formatCurrency(contribTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {contributions.length === 0 && manualIncome.length === 0 && !search && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
              <p className="text-slate-500">No income recorded yet.</p>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false, id: '', label: '' })}
        onConfirm={handleDelete}
        title="Delete Entry"
        message={`Delete "${confirmDelete.label}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
      />
      <CategoryManagerModal
        open={categoriesOpen}
        onClose={() => setCategoriesOpen(false)}
        table="income_categories"
        title="Income Categories"
        description="Manage categories used to classify non-contribution income entries."
      />
    </div>
  )
}
