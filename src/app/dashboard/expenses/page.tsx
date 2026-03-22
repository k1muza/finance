'use client'

import { useState } from 'react'
import { useExpenses } from '@/hooks/useExpenses'
import { useDistricts } from '@/hooks/useDistricts'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { PageSpinner } from '@/components/ui/Spinner'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { PlusCircle, Trash2, TrendingDown, Search } from 'lucide-react'

const today = () => new Date().toISOString().split('T')[0]

interface AddForm {
  district_id: string
  description: string
  amount: string
  date: string
}

const emptyForm: AddForm = { district_id: '', description: '', amount: '', date: today() }

export default function ExpensesPage() {
  const { districtId, isAdmin } = useAuth()

  // District users are always scoped to their district
  const [districtFilter, setDistrictFilter] = useState('')
  const [search, setSearch] = useState('')

  // Effective filter: district users can't override their own district
  const effectiveDistrictId = isAdmin ? (districtFilter || undefined) : (districtId ?? undefined)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<AddForm>({ ...emptyForm, district_id: districtId ?? '' })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string; label: string }>({
    open: false, id: '', label: '',
  })
  const [deleting, setDeleting] = useState(false)

  const { data: expenses, loading, total, add, remove } = useExpenses({
    district_id: effectiveDistrictId,
    search: search || undefined,
  })
  const { data: districts } = useDistricts()
  const toast = useToast()

  // Per-district breakdown (unfiltered total from current fetch)
  const byDistrict = expenses.reduce<Record<string, { name: string; total: number }>>((acc, e) => {
    const did = e.district_id
    const name = (e.district as { name?: string })?.name ?? 'Unknown'
    if (!acc[did]) acc[did] = { name, total: 0 }
    acc[did].total += e.amount
    return acc
  }, {})

  const setField = (field: keyof AddForm, value: string) =>
    setForm((f) => ({ ...f, [field]: value }))

  const validateForm = () => {
    const e: Record<string, string> = {}
    if (!form.district_id) e.district_id = 'Select a district'
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
        district_id: form.district_id,
        description: form.description.trim(),
        amount: parseFloat(form.amount),
        date: form.date,
      })
      setForm({ ...emptyForm, district_id: districtId ?? '' })
      setAdding(false)
      toast.success('Expense recorded')
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await remove(confirmDelete.id)
      setConfirmDelete({ open: false, id: '', label: '' })
      toast.success('Expense deleted')
    } catch (e) {
      toast.error(String(e))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Expenses</h1>
          <p className="text-sm text-slate-400 mt-1">Track conference expenses by district</p>
        </div>
        {!adding && (
          <Button onClick={() => setAdding(true)}>
            <PlusCircle className="h-4 w-4" /> Add Expense
          </Button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex items-start gap-4">
          <div className="bg-red-500/10 rounded-lg p-3 text-red-400">
            <TrendingDown className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-slate-400">
              {districtFilter
                ? `${districts.find((d) => d.id === districtFilter)?.name ?? 'District'} Expenses`
                : 'Total Expenses'}
            </p>
            <p className="text-2xl font-bold text-red-400 mt-0.5">{formatCurrency(total)}</p>
            <p className="text-xs text-slate-500 mt-1">{expenses.length} transaction{expenses.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {Object.entries(byDistrict).map(([, { name, total: dt }]) => (
          <div key={name} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <p className="text-sm text-slate-400 truncate">{name}</p>
            <p className="text-xl font-bold text-slate-100 mt-1">{formatCurrency(dt)}</p>
          </div>
        ))}
      </div>

      {/* Add form */}
      {adding && (
        <div className="bg-slate-800 border border-cyan-500/30 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300">New Expense</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {isAdmin && (
              <Select
                label="District *"
                value={form.district_id}
                onChange={(e) => setField('district_id', e.target.value)}
                placeholder="Select district"
                options={districts.map((d) => ({ value: d.id, label: d.name }))}
                error={formErrors.district_id}
              />
            )}
            <div className={isAdmin ? 'lg:col-span-2' : 'lg:col-span-3'}>
              <Input
                label="Description *"
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                placeholder="e.g. Venue hire, Catering, Transport"
                error={formErrors.description}
              />
            </div>
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
                Save Expense
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 flex-1 min-w-48">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none flex-1"
          />
        </div>
        {isAdmin && (
          <Select
            value={districtFilter}
            onChange={(e) => setDistrictFilter(e.target.value)}
            placeholder="All districts"
            options={districts.map((d) => ({ value: d.id, label: d.name }))}
            className="w-48"
          />
        )}
      </div>

      {/* Table */}
      {loading ? (
        <PageSpinner />
      ) : expenses.length === 0 ? (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
          <p className="text-slate-500">No expenses recorded yet.</p>
        </div>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Date</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Description</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">District</th>
                  <th className="text-right px-4 py-3 text-slate-400 font-medium">Amount</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-b border-slate-700/50 last:border-0 hover:bg-slate-700/30 transition">
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                      {new Date(e.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-slate-100">{e.description}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {(e.district as { name?: string })?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-red-400">
                      {formatCurrency(e.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setConfirmDelete({ open: true, id: e.id, label: e.description })}
                        className="text-slate-500 hover:text-red-400 transition"
                        title="Delete expense"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-700 bg-slate-900/50">
                  <td colSpan={3} className="px-4 py-3 text-slate-400 text-sm font-medium">
                    {districtFilter ? `${districts.find((d) => d.id === districtFilter)?.name ?? 'District'} total` : 'Grand total'}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-red-400">
                    {formatCurrency(total)}
                  </td>
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
        title="Delete Expense"
        message={`Delete "${confirmDelete.label}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  )
}
