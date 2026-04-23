'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { useBudgets } from '@/hooks/useBudgets'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageSpinner } from '@/components/ui/Spinner'
import { SelectDistrictHint } from '@/components/layout/SelectDistrictHint'
import {
  BudgetFormModal,
  BudgetListView,
  emptyBudgetForm,
  type BudgetFormState,
} from './_components/budget-ui'

export default function BudgetsPage() {
  const router = useRouter()
  const { districtId } = useAuth()
  const { can } = usePermissions()
  const toast = useToast()
  const { data: budgets, loading, createDraft } = useBudgets({ district_id: districtId })

  const [budgetModalOpen, setBudgetModalOpen] = useState(false)
  const [budgetForm, setBudgetForm] = useState<BudgetFormState>(emptyBudgetForm())
  const [budgetSaving, setBudgetSaving] = useState(false)

  const canManageBudgets = can('budgets.manage')
  const closeBudgetModal = () => {
    setBudgetModalOpen(false)
    setBudgetForm(emptyBudgetForm())
  }

  const beginAddBudget = () => {
    setBudgetForm(emptyBudgetForm())
    setBudgetModalOpen(true)
  }

  const handleSaveBudget = async () => {
    if (!districtId) return

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
      const createdBudget = await createDraft({
        district_id: districtId,
        name: budgetForm.name,
        start_date: budgetForm.start_date,
        end_date: budgetForm.end_date,
        description: budgetForm.description || null,
      })

      toast.success('Draft budget created')
      closeBudgetModal()
      router.push(`/dashboard/finance/budgets/${createdBudget.id}`)
    } catch (error) {
      toast.error(String(error))
    } finally {
      setBudgetSaving(false)
    }
  }

  if (!districtId) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <PageHeader
          title="Budgets"
          description="Create draft expense budgets, open a budget detail page, and compare approved plans with actual spending."
        />
        <SelectDistrictHint description="Choose a district to manage its budgets." />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <PageHeader
          title="Budgets"
          description="Create draft expense budgets, open a budget detail page, and compare approved plans with actual spending."
        />
        <PageSpinner />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <PageHeader
        title="Budgets"
        description="Choose an expense budget from the list to open its standalone detail page."
        actions={canManageBudgets ? (
          <Button onClick={beginAddBudget}>
            <Plus className="h-4 w-4" />
            New Budget
          </Button>
        ) : undefined}
      />

      <BudgetListView
        budgets={budgets}
        getBudgetHref={(budget) => `/dashboard/finance/budgets/${budget.id}`}
      />

      <BudgetFormModal
        open={budgetModalOpen}
        mode="create"
        form={budgetForm}
        onChange={(patch) => setBudgetForm((current) => ({ ...current, ...patch }))}
        onClose={closeBudgetModal}
        onSave={handleSaveBudget}
        loading={budgetSaving}
      />
    </div>
  )
}
