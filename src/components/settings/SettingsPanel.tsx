'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Upload,
  CheckCircle,
  AlertCircle,
  Loader,
  FileText,
  Trash2,
  Building2,
  Landmark,
  PiggyBank,
  Target,
  Pencil,
  Plus,
  Check,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { useDistricts } from '@/hooks/useDistricts'
import { useFunds } from '@/hooks/useFunds'
import { useBudgets } from '@/hooks/useBudgets'
import { useCategories } from '@/hooks/useCategories'
import { Budget, BudgetType, Fund } from '@/types'

interface ImportResult {
  imported: number
  updated?: number
  errors: string[]
  error?: string
}

interface TabConfig {
  key: string
  label: string
  endpoint: string
  columns: string[]
  notes?: string
  requiresDistrict?: boolean
}

interface FundFormState {
  name: string
  description: string
  is_restricted: boolean
}

interface BudgetFormState {
  type: BudgetType
  fund_id: string
  category: string
  amount: string
  period_start: string
  period_end: string
  notes: string
}

const IMPORT_TABS: TabConfig[] = [
  {
    key: 'districts',
    label: 'Districts',
    endpoint: '/api/import/districts',
    columns: ['id', 'name'],
    notes: 'id is optional. Use it when you want to safely upsert districts from a controlled source file.',
  },
  {
    key: 'income',
    label: 'Income',
    endpoint: '/api/import/income',
    columns: ['district', 'fund', 'description', 'amount', 'date', 'category'],
    notes: 'date must be in YYYY-MM-DD format. fund and category are optional.',
    requiresDistrict: true,
  },
  {
    key: 'expenses',
    label: 'Expenditure',
    endpoint: '/api/import/expenses',
    columns: ['district', 'fund', 'description', 'amount', 'date', 'category'],
    notes: 'date must be in YYYY-MM-DD format. fund and category are optional.',
    requiresDistrict: true,
  },
]

const emptyFundForm: FundFormState = {
  name: '',
  description: '',
  is_restricted: false,
}

const toIsoDate = (date: Date) => date.toISOString().split('T')[0]

const defaultBudgetForm = (): BudgetFormState => {
  const start = new Date()
  start.setDate(1)

  const end = new Date(start)
  end.setMonth(end.getMonth() + 1)
  end.setDate(0)

  return {
    type: 'expense',
    fund_id: '',
    category: '',
    amount: '',
    period_start: toIsoDate(start),
    period_end: toIsoDate(end),
    notes: '',
  }
}

function formatPeriod(start: string, end: string) {
  const startLabel = new Date(start).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  const endLabel = new Date(end).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  return `${startLabel} - ${endLabel}`
}

function ImportSection({ tab, districtId }: { tab: TabConfig; districtId: string | null }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    setFileName(file?.name ?? null)
    setResult(null)
  }

  const handleImport = async () => {
    const file = inputRef.current?.files?.[0]
    if (!file) return
    setLoading(true)
    setResult(null)
    try {
      const body = new FormData()
      body.append('file', file)
      if (districtId) body.append('district_id', districtId)
      const res = await fetch(tab.endpoint, { method: 'POST', body })
      const json = await res.json()
      setResult(json)
    } catch (e) {
      setResult({ imported: 0, errors: [], error: String(e) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
      <div>
        <h3 className="font-semibold text-slate-100">{tab.label}</h3>
        {tab.notes && <p className="text-xs text-slate-500 mt-0.5">{tab.notes}</p>}
      </div>

      <div className="overflow-x-auto">
        <table className="text-xs w-full">
          <thead>
            <tr>
              {tab.columns.map((col) => (
                <th key={col} className="text-left px-2 py-1 text-slate-400 font-mono bg-slate-900 border border-slate-700 first:rounded-tl last:rounded-tr">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {tab.columns.map((col) => (
                <td key={col} className="px-2 py-1 text-slate-600 italic border border-slate-700/50">
                  {col === 'id' ? 'optional' : col === 'date' ? 'YYYY-MM-DD' : '...'}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {tab.requiresDistrict && !districtId ? (
        <p className="text-xs text-amber-400">Select an active district before importing {tab.label.toLowerCase()}.</p>
      ) : (
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-600 bg-slate-700/50 hover:bg-slate-700 cursor-pointer text-sm text-slate-300 transition-colors">
            <FileText className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="truncate max-w-50">{fileName ?? 'Choose CSV file...'}</span>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
          <Button onClick={handleImport} disabled={loading || !fileName} size="sm">
            {loading ? <Loader className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {loading ? 'Importing...' : 'Import'}
          </Button>
        </div>
      )}

      {result && (
        <div className={`rounded-lg px-4 py-3 text-sm space-y-1 ${result.error ? 'bg-red-500/10 border border-red-500/30 text-red-400' : 'bg-slate-700/50 border border-slate-600'}`}>
          {result.error ? (
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{result.error}</span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span>
                  {result.imported} imported
                  {typeof result.updated === 'number' ? ` · ${result.updated} updated` : ''}
                </span>
              </div>
              {result.errors.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-amber-400 text-xs">
                  {result.errors.map((err, i) => (
                    <li key={i} className="flex items-start gap-1">
                      <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                      {err}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
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

function FundsSection({ districtId }: { districtId: string }) {
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
        description: newFund.description || null,
        is_restricted: newFund.is_restricted,
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
      description: fund.description ?? '',
      is_restricted: fund.is_restricted,
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
        description: draftFund.description || null,
        is_restricted: draftFund.is_restricted,
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Input
                label="Fund name *"
                value={newFund.name}
                onChange={(e) => setNewFund((current) => ({ ...current, name: e.target.value }))}
                placeholder="e.g. Building Fund"
              />
              <Input
                label="Description"
                value={newFund.description}
                onChange={(e) => setNewFund((current) => ({ ...current, description: e.target.value }))}
                placeholder="Optional notes about how this fund is used"
              />
              <label className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 mt-6 lg:mt-0">
                <input
                  type="checkbox"
                  checked={newFund.is_restricted}
                  onChange={(e) => setNewFund((current) => ({ ...current, is_restricted: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                />
                <div>
                  <p className="text-sm text-slate-200">Restricted fund</p>
                  <p className="text-xs text-slate-500">Use this for earmarked income like building or missions.</p>
                </div>
              </label>
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
                          <Input
                            value={draftFund.name}
                            onChange={(e) => setDraftFund((current) => ({ ...current, name: e.target.value }))}
                            placeholder="Fund name"
                          />
                        ) : (
                          <div className="space-y-1">
                            <p className="text-slate-100 font-medium">{fund.name}</p>
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
                          <label className="flex items-center gap-2 text-sm text-slate-300">
                            <input
                              type="checkbox"
                              checked={draftFund.is_restricted}
                              onChange={(e) => setDraftFund((current) => ({ ...current, is_restricted: e.target.checked }))}
                              className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                            />
                            Restricted fund
                          </label>
                        ) : (
                          <Badge variant={fund.is_restricted ? 'yellow' : 'teal'}>
                            {fund.is_restricted ? 'Restricted' : 'Open use'}
                          </Badge>
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

function BudgetsSection({ districtId }: { districtId: string }) {
  const { data: funds } = useFunds({ district_id: districtId })
  const { data: budgets, loading, add, update, remove } = useBudgets({ district_id: districtId })
  const { data: incomeCategories } = useCategories('income_categories')
  const { data: expenseCategories } = useCategories('expense_categories')
  const toast = useToast()

  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newBudget, setNewBudget] = useState<BudgetFormState>(defaultBudgetForm())

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [draftBudget, setDraftBudget] = useState<BudgetFormState>(defaultBudgetForm())

  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; budget: Budget | null }>({
    open: false,
    budget: null,
  })
  const [deleting, setDeleting] = useState(false)

  const categoryOptions = (type: BudgetType) => type === 'income' ? incomeCategories : expenseCategories

  const validateBudget = (form: BudgetFormState) => {
    if (!form.category.trim()) {
      toast.error('Budget category is required')
      return false
    }

    const amount = parseFloat(form.amount)
    if (!form.amount || Number.isNaN(amount) || amount <= 0) {
      toast.error('Enter a valid budget amount')
      return false
    }

    if (!form.period_start || !form.period_end) {
      toast.error('Select a budget period')
      return false
    }

    if (form.period_end < form.period_start) {
      toast.error('Budget end date must be on or after the start date')
      return false
    }

    return true
  }

  const handleAdd = async () => {
    if (!validateBudget(newBudget)) return

    setSaving(true)
    try {
      await add({
        district_id: districtId,
        fund_id: newBudget.fund_id || null,
        type: newBudget.type,
        category: newBudget.category,
        amount: parseFloat(newBudget.amount),
        period_start: newBudget.period_start,
        period_end: newBudget.period_end,
        notes: newBudget.notes || null,
      })
      setNewBudget(defaultBudgetForm())
      setAdding(false)
      toast.success('Budget added')
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (budget: Budget) => {
    setEditingId(budget.id)
    setDraftBudget({
      type: budget.type,
      fund_id: budget.fund_id ?? '',
      category: budget.category,
      amount: String(budget.amount),
      period_start: budget.period_start,
      period_end: budget.period_end,
      notes: budget.notes ?? '',
    })
  }

  const saveEdit = async (budgetId: string) => {
    if (!validateBudget(draftBudget)) return

    setEditSaving(true)
    try {
      await update(budgetId, {
        type: draftBudget.type,
        fund_id: draftBudget.fund_id || null,
        category: draftBudget.category,
        amount: parseFloat(draftBudget.amount),
        period_start: draftBudget.period_start,
        period_end: draftBudget.period_end,
        notes: draftBudget.notes || null,
      })
      setEditingId(null)
      toast.success('Budget updated')
    } catch (e) {
      toast.error(String(e))
    } finally {
      setEditSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete.budget) return
    setDeleting(true)
    try {
      await remove(confirmDelete.budget.id)
      setConfirmDelete({ open: false, budget: null })
      toast.success('Budget deleted')
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
              <Target className="h-5 w-5 text-cyan-400" />
              Budgets
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Plan income targets and expenditure limits by fund, category, and date range.
            </p>
          </div>
          {!adding && (
            <Button variant="ghost" size="sm" onClick={() => { setAdding(true); setNewBudget(defaultBudgetForm()) }}>
              <Plus className="h-4 w-4" />
              Add budget
            </Button>
          )}
        </div>

        {adding && (
          <div className="px-5 py-4 border-b border-slate-700 bg-slate-900/40 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <Select
                label="Type"
                value={newBudget.type}
                onChange={(e) => setNewBudget((current) => ({ ...current, type: e.target.value as BudgetType }))}
                options={[
                  { value: 'expense', label: 'Expenditure budget' },
                  { value: 'income', label: 'Income target' },
                ]}
              />
              <Select
                label="Fund"
                value={newBudget.fund_id}
                onChange={(e) => setNewBudget((current) => ({ ...current, fund_id: e.target.value }))}
                placeholder="All funds"
                options={funds.map((fund) => ({
                  value: fund.id,
                  label: `${fund.name}${fund.is_restricted ? ' (Restricted)' : ''}`,
                }))}
              />
              <div>
                <Input
                  label="Category *"
                  value={newBudget.category}
                  onChange={(e) => setNewBudget((current) => ({ ...current, category: e.target.value }))}
                  placeholder={newBudget.type === 'income' ? 'e.g. Offerings' : 'e.g. Utilities'}
                  list={`budget-categories-${newBudget.type}`}
                />
                <datalist id={`budget-categories-${newBudget.type}`}>
                  {categoryOptions(newBudget.type).map((category) => (
                    <option key={category.id} value={category.name} />
                  ))}
                </datalist>
              </div>
              <Input
                label="Amount *"
                type="number"
                min="0.01"
                step="0.01"
                value={newBudget.amount}
                onChange={(e) => setNewBudget((current) => ({ ...current, amount: e.target.value }))}
                placeholder="0.00"
              />
              <Input
                label="Period start *"
                type="date"
                value={newBudget.period_start}
                onChange={(e) => setNewBudget((current) => ({ ...current, period_start: e.target.value }))}
              />
              <Input
                label="Period end *"
                type="date"
                value={newBudget.period_end}
                onChange={(e) => setNewBudget((current) => ({ ...current, period_end: e.target.value }))}
              />
            </div>
            <Input
              label="Notes"
              value={newBudget.notes}
              onChange={(e) => setNewBudget((current) => ({ ...current, notes: e.target.value }))}
              placeholder="Optional commentary or planning notes"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAdding(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleAdd} loading={saving}>
                Save budget
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="px-5 py-8 text-sm text-slate-500">Loading budgets...</div>
        ) : budgets.length === 0 ? (
          <div className="px-5 py-8 text-sm text-slate-500">No budgets yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Type</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Fund</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Category</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Period</th>
                  <th className="text-right px-4 py-3 text-slate-400 font-medium">Amount</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Notes</th>
                  <th className="w-28 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {budgets.map((budget) => {
                  const isEditing = editingId === budget.id
                  return (
                    <tr key={budget.id} className={`border-b border-slate-700/50 last:border-0 ${isEditing ? 'bg-slate-900/40' : ''}`}>
                      <td className="px-4 py-3 align-top min-w-[170px]">
                        {isEditing ? (
                          <Select
                            value={draftBudget.type}
                            onChange={(e) => setDraftBudget((current) => ({ ...current, type: e.target.value as BudgetType }))}
                            options={[
                              { value: 'expense', label: 'Expenditure budget' },
                              { value: 'income', label: 'Income target' },
                            ]}
                          />
                        ) : (
                          <Badge variant={budget.type === 'income' ? 'green' : 'yellow'}>
                            {budget.type === 'income' ? 'Income target' : 'Expenditure budget'}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top min-w-[180px]">
                        {isEditing ? (
                          <Select
                            value={draftBudget.fund_id}
                            onChange={(e) => setDraftBudget((current) => ({ ...current, fund_id: e.target.value }))}
                            placeholder="All funds"
                            options={funds.map((fund) => ({
                              value: fund.id,
                              label: `${fund.name}${fund.is_restricted ? ' (Restricted)' : ''}`,
                            }))}
                          />
                        ) : (
                          <span className="text-slate-200">{budget.fund?.name ?? 'All funds'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top min-w-[180px]">
                        {isEditing ? (
                          <div>
                            <Input
                              value={draftBudget.category}
                              onChange={(e) => setDraftBudget((current) => ({ ...current, category: e.target.value }))}
                              placeholder="Category"
                              list={`edit-budget-categories-${budget.id}-${draftBudget.type}`}
                            />
                            <datalist id={`edit-budget-categories-${budget.id}-${draftBudget.type}`}>
                              {categoryOptions(draftBudget.type).map((category) => (
                                <option key={category.id} value={category.name} />
                              ))}
                            </datalist>
                          </div>
                        ) : (
                          <span className="text-slate-100">{budget.category}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top min-w-[220px]">
                        {isEditing ? (
                          <div className="grid grid-cols-1 gap-2">
                            <Input
                              type="date"
                              value={draftBudget.period_start}
                              onChange={(e) => setDraftBudget((current) => ({ ...current, period_start: e.target.value }))}
                            />
                            <Input
                              type="date"
                              value={draftBudget.period_end}
                              onChange={(e) => setDraftBudget((current) => ({ ...current, period_end: e.target.value }))}
                            />
                          </div>
                        ) : (
                          <span className="text-slate-300">{formatPeriod(budget.period_start, budget.period_end)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top min-w-[120px]">
                        {isEditing ? (
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={draftBudget.amount}
                            onChange={(e) => setDraftBudget((current) => ({ ...current, amount: e.target.value }))}
                            placeholder="0.00"
                          />
                        ) : (
                          <span className="text-right block font-semibold text-slate-100">${budget.amount.toFixed(2)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top min-w-[240px]">
                        {isEditing ? (
                          <Input
                            value={draftBudget.notes}
                            onChange={(e) => setDraftBudget((current) => ({ ...current, notes: e.target.value }))}
                            placeholder="Optional notes"
                          />
                        ) : (
                          <span className={budget.notes ? 'text-slate-300' : 'text-slate-500'}>
                            {budget.notes ?? 'No notes'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => saveEdit(budget.id)} disabled={editSaving} className="text-emerald-400 hover:text-emerald-300">
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} disabled={editSaving}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => startEdit(budget)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete({ open: true, budget })} className="text-red-400 hover:text-red-300">
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
        onClose={() => setConfirmDelete({ open: false, budget: null })}
        onConfirm={handleDelete}
        title="Delete Budget"
        message={`Delete the ${confirmDelete.budget?.type === 'income' ? 'income' : 'expenditure'} budget for "${confirmDelete.budget?.category ?? ''}"?`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </>
  )
}

function DangerZone({ districtId }: { districtId?: string | null }) {
  const { data: districts, remove } = useDistricts()
  const { setActiveDistrictId } = useAuth()
  const router = useRouter()

  const [confirmDistrict, setConfirmDistrict] = useState(false)
  const [loadingDistrict, setLoadingDistrict] = useState(false)
  const [errorDistrict, setErrorDistrict] = useState<string | null>(null)

  const handleDeleteDistrict = async () => {
    if (!districtId) return
    setLoadingDistrict(true)
    setErrorDistrict(null)
    try {
      await remove(districtId)
      const remaining = districts.filter((d) => d.id !== districtId)
      if (remaining.length === 0) {
        setActiveDistrictId(null)
        router.push('/dashboard/setup')
      } else {
        setActiveDistrictId(null)
      }
    } catch (e) {
      setErrorDistrict(String(e))
      setConfirmDistrict(false)
    } finally {
      setLoadingDistrict(false)
    }
  }

  return (
    <div className="bg-red-950/30 border border-red-800/50 rounded-xl p-5 space-y-4">
      <h2 className="font-semibold text-red-400 flex items-center gap-2">
        <Trash2 className="h-5 w-5" />
        Danger Zone
      </h2>

      {districtId && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm text-slate-300 font-medium">Delete this district</p>
            <p className="text-xs text-slate-500 mt-0.5">Permanently removes the district and all associated income and expenditure data.</p>
          </div>
          {!confirmDistrict ? (
            <Button variant="danger" size="sm" onClick={() => setConfirmDistrict(true)}>
              Delete district
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-400">This cannot be undone.</span>
              <Button variant="danger" size="sm" onClick={handleDeleteDistrict} disabled={loadingDistrict}>
                {loadingDistrict ? <Loader className="h-4 w-4 animate-spin" /> : null}
                Yes, delete
              </Button>
              <Button size="sm" onClick={() => setConfirmDistrict(false)} disabled={loadingDistrict}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}

      {errorDistrict && (
        <div className="flex items-center gap-2 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {errorDistrict}
        </div>
      )}
    </div>
  )
}

function SelectDistrictHint() {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex items-start gap-3">
      <Landmark className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
      <div>
        <h2 className="text-sm font-semibold text-slate-100">Select a district</h2>
        <p className="text-sm text-slate-400 mt-1">
          Choose a district from the top bar to manage funds, budgets, district settings, or scoped imports.
        </p>
      </div>
    </div>
  )
}

export function SettingsPanel() {
  const { districtId, isAdmin } = useAuth()

  return (
    <div className="space-y-6">
      {districtId ? <FundsSection districtId={districtId} /> : <SelectDistrictHint />}
      {districtId && <BudgetsSection districtId={districtId} />}

      {isAdmin && districtId && <DistrictSettings key={districtId} districtId={districtId} />}

      {isAdmin && (
        <>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-2">
            <h2 className="font-semibold text-slate-100 flex items-center gap-2">
              <Upload className="h-5 w-5 text-cyan-400" />
              CSV Import
            </h2>
            <p className="text-sm text-slate-400">
              Import districts, income, or expenditure from CSV files. Income and expenditure imports can optionally map each row to a fund.
            </p>
          </div>

          <div className="space-y-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Finance import tools</p>
            {IMPORT_TABS.map((tab) => (
              <ImportSection key={tab.key} tab={tab} districtId={districtId} />
            ))}
          </div>

          <DangerZone districtId={districtId} />
        </>
      )}
    </div>
  )
}
