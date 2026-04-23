'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { useBudgets } from '@/hooks/useBudgets'
import { useCurrencies } from '@/hooks/useCurrencies'
import { useFunds } from '@/hooks/useFunds'
import { useMembers } from '@/hooks/useMembers'
import { useToast } from '@/components/ui/Toast'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageSpinner } from '@/components/ui/Spinner'
import { SelectDistrictHint } from '@/components/layout/SelectDistrictHint'
import {
  MEMBER_TYPE_LABELS,
  type Budget,
  type BudgetLine,
} from '@/types'
import {
  BudgetActions,
  BudgetDetailView,
  BudgetFormModal,
  BudgetLineModal,
  BudgetStatusBadge,
  emptyBudgetForm,
  emptyLineForm,
  formatBudgetPeriod,
  type BudgetFormState,
  type BudgetLineFormState,
} from '../_components/budget-ui'

export default function BudgetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { districtId } = useAuth()
  const { can } = usePermissions()
  const toast = useToast()

  const {
    data: budgets,
    loading: budgetsLoading,
    updateDraft,
    deleteDraft,
    addLine,
    updateLine,
    deleteLine,
    activate,
    close,
  } = useBudgets({ district_id: districtId, id })
  const { data: currencies, loading: currenciesLoading } = useCurrencies()
  const { data: funds, loading: fundsLoading } = useFunds({ district_id: districtId })
  const { data: members, loading: membersLoading } = useMembers({ district_id: districtId })

  const [budgetForm, setBudgetForm] = useState<BudgetFormState>(emptyBudgetForm())
  const [budgetModalOpen, setBudgetModalOpen] = useState(false)
  const [budgetSaving, setBudgetSaving] = useState(false)

  const [lineForm, setLineForm] = useState<BudgetLineFormState>(emptyLineForm())
  const [lineModalMode, setLineModalMode] = useState<'create' | 'edit' | null>(null)
  const [editingLineId, setEditingLineId] = useState<string | null>(null)
  const [lineSaving, setLineSaving] = useState(false)

  const [confirmDeleteBudget, setConfirmDeleteBudget] = useState<Budget | null>(null)
  const [confirmDeleteLine, setConfirmDeleteLine] = useState<BudgetLine | null>(null)
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const budget = budgets[0] ?? null
  const loading = budgetsLoading || currenciesLoading || fundsLoading || membersLoading

  const currencyOptions = useMemo(
    () => currencies.map((currency) => ({ value: currency.code, label: `${currency.code} - ${currency.name}` })),
    [currencies],
  )
  const defaultCurrency = currencyOptions[0]?.value ?? 'USD'
  const fundOptions = useMemo(
    () => funds
      .filter((fund) => fund.is_active && fund.nature !== 'income_only')
      .map((fund) => ({ value: fund.id, label: fund.name })),
    [funds],
  )
  const memberOptions = useMemo(
    () => members
      .filter((member) => member.is_active && member.type !== 'district')
      .map((member) => ({
        value: member.id,
        label: `${MEMBER_TYPE_LABELS[member.type]} - ${member.name}`,
      })),
    [members],
  )

  const canManageBudgets = can('budgets.manage')
  const canActivateBudgets = can('budgets.activate')
  const canCloseBudgets = can('budgets.close')

  const closeBudgetModal = () => {
    setBudgetModalOpen(false)
    setBudgetForm(emptyBudgetForm())
  }

  const closeLineModal = () => {
    setLineModalMode(null)
    setEditingLineId(null)
    setLineForm(emptyLineForm(defaultCurrency))
  }

  const beginEditBudget = (currentBudget: Budget) => {
    setBudgetForm({
      name: currentBudget.name,
      start_date: currentBudget.start_date,
      end_date: currentBudget.end_date,
      description: currentBudget.description ?? '',
    })
    setBudgetModalOpen(true)
  }

  const beginAddLine = () => {
    setEditingLineId(null)
    setLineForm(emptyLineForm(defaultCurrency))
    setLineModalMode('create')
  }

  const beginEditLine = (line: BudgetLine) => {
    setEditingLineId(line.id)
    setLineForm({
      fund_id: line.fund_id,
      line_description: line.line_description,
      currency: line.currency,
      amount: String(Number(line.amount)),
      scope_member_id: line.scope_member_id ?? '',
      notes: line.notes ?? '',
    })
    setLineModalMode('edit')
  }

  const handleSaveBudget = async () => {
    if (!budget) return

    if (!budgetForm.name.trim()) {
      toast.error('Budget name is required')
      return
    }
    if (!budgetForm.start_date || !budgetForm.end_date) {
      toast.error('Start and end dates are required')
      return
    }
    if (budgetForm.end_date < budgetForm.start_date) {
      toast.error('Budget end date must be on or after the start date')
      return
    }

    setBudgetSaving(true)
    try {
      await updateDraft(budget.id, {
        name: budgetForm.name,
        start_date: budgetForm.start_date,
        end_date: budgetForm.end_date,
        description: budgetForm.description || null,
      })
      toast.success('Budget updated')
      closeBudgetModal()
    } catch (error) {
      toast.error(String(error))
    } finally {
      setBudgetSaving(false)
    }
  }

  const handleDeleteBudget = async () => {
    if (!confirmDeleteBudget) return

    setDeleteLoading(`budget:${confirmDeleteBudget.id}`)
    try {
      await deleteDraft(confirmDeleteBudget.id)
      toast.success('Budget deleted')
      setConfirmDeleteBudget(null)
      router.push('/dashboard/finance/budgets')
    } catch (error) {
      toast.error(String(error))
    } finally {
      setDeleteLoading(null)
    }
  }

  const handleSaveLine = async () => {
    if (!districtId || !budget) return

    const amount = Number(lineForm.amount)
    if (!lineForm.fund_id) {
      toast.error('Select a fund')
      return
    }
    if (!lineForm.line_description.trim()) {
      toast.error('Line description is required')
      return
    }
    if (!lineForm.currency) {
      toast.error('Select a currency')
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Line amount must be greater than 0')
      return
    }

    setLineSaving(true)
    try {
      if (editingLineId) {
        await updateLine(editingLineId, {
          fund_id: lineForm.fund_id,
          line_description: lineForm.line_description,
          currency: lineForm.currency,
          amount,
          scope_member_id: lineForm.scope_member_id || null,
          notes: lineForm.notes || null,
        })
        toast.success('Budget line updated')
      } else {
        await addLine({
          district_id: districtId,
          budget_id: budget.id,
          fund_id: lineForm.fund_id,
          line_description: lineForm.line_description,
          currency: lineForm.currency,
          amount,
          scope_member_id: lineForm.scope_member_id || null,
          notes: lineForm.notes || null,
        })
        toast.success('Budget line added')
      }

      closeLineModal()
    } catch (error) {
      toast.error(String(error))
    } finally {
      setLineSaving(false)
    }
  }

  const handleDeleteLine = async () => {
    if (!confirmDeleteLine) return

    setDeleteLoading(`line:${confirmDeleteLine.id}`)
    try {
      await deleteLine(confirmDeleteLine.id)
      toast.success('Budget line deleted')
      setConfirmDeleteLine(null)
    } catch (error) {
      toast.error(String(error))
    } finally {
      setDeleteLoading(null)
    }
  }

  const handleActivateBudget = async (currentBudget: Budget) => {
    setActionLoading(`activate:${currentBudget.id}`)
    try {
      await activate(currentBudget.id)
      toast.success('Budget activated')
    } catch (error) {
      toast.error(String(error))
    } finally {
      setActionLoading(null)
    }
  }

  const handleCloseBudget = async (currentBudget: Budget) => {
    setActionLoading(`close:${currentBudget.id}`)
    try {
      await close(currentBudget.id)
      toast.success('Budget closed')
    } catch (error) {
      toast.error(String(error))
    } finally {
      setActionLoading(null)
    }
  }

  if (!districtId) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <PageHeader
          title="Budget Detail"
          description="Open a district to review and manage one expense budget at a time."
        />
        <SelectDistrictHint description="Choose a district to manage its budgets." />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <PageHeader
          title="Budget Detail"
          description="Open a district to review and manage one expense budget at a time."
        />
        <PageSpinner />
      </div>
    )
  }

  if (!budget) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <Link
          href="/dashboard/finance/budgets"
          className="inline-flex items-center gap-1 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          All budgets
        </Link>

        <PageHeader
          title="Budget Not Found"
          description="The selected budget could not be found for this district."
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <Link
        href="/dashboard/finance/budgets"
        className="inline-flex items-center gap-1 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
      >
        <ArrowLeft className="h-4 w-4" />
        All budgets
      </Link>

      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {budget.name}
            <BudgetStatusBadge status={budget.status} />
          </span>
        }
        description={budget.description || formatBudgetPeriod(budget)}
        actions={
          <BudgetActions
            budget={budget}
            canManageBudgets={canManageBudgets}
            canActivateBudgets={canActivateBudgets}
            canCloseBudgets={canCloseBudgets}
            onEditBudget={beginEditBudget}
            onDeleteBudget={setConfirmDeleteBudget}
            onActivateBudget={handleActivateBudget}
            onCloseBudget={handleCloseBudget}
            actionLoading={actionLoading}
          />
        }
      />

      <BudgetDetailView
        budget={budget}
        canManageBudgets={canManageBudgets}
        canActivateBudgets={canActivateBudgets}
        canCloseBudgets={canCloseBudgets}
        onEditBudget={beginEditBudget}
        onDeleteBudget={setConfirmDeleteBudget}
        onActivateBudget={handleActivateBudget}
        onCloseBudget={handleCloseBudget}
        onAddLine={beginAddLine}
        onEditLine={beginEditLine}
        onDeleteLine={setConfirmDeleteLine}
        actionLoading={actionLoading}
      />

      <BudgetFormModal
        open={budgetModalOpen}
        mode="edit"
        form={budgetForm}
        onChange={(patch) => setBudgetForm((current) => ({ ...current, ...patch }))}
        onClose={closeBudgetModal}
        onSave={handleSaveBudget}
        loading={budgetSaving}
      />

      <BudgetLineModal
        open={lineModalMode != null}
        mode={lineModalMode}
        form={lineForm}
        fundOptions={fundOptions}
        currencyOptions={currencyOptions}
        memberOptions={memberOptions}
        onChange={(patch) => setLineForm((current) => ({ ...current, ...patch }))}
        onClose={closeLineModal}
        onSave={handleSaveLine}
        loading={lineSaving}
      />

      <ConfirmDialog
        open={confirmDeleteBudget != null}
        onClose={() => setConfirmDeleteBudget(null)}
        onConfirm={handleDeleteBudget}
        title="Delete Budget"
        message={`Delete "${confirmDeleteBudget?.name ?? ''}" and all of its lines?`}
        confirmLabel="Delete"
        loading={deleteLoading === `budget:${confirmDeleteBudget?.id ?? ''}`}
      />

      <ConfirmDialog
        open={confirmDeleteLine != null}
        onClose={() => setConfirmDeleteLine(null)}
        onConfirm={handleDeleteLine}
        title="Delete Expense Line"
        message={`Delete "${confirmDeleteLine?.line_description ?? 'this expense line'}" under "${confirmDeleteLine?.fund?.name ?? 'this fund'}"?`}
        confirmLabel="Delete"
        loading={deleteLoading === `line:${confirmDeleteLine?.id ?? ''}`}
      />
    </div>
  )
}
