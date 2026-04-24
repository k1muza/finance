'use client'

import Link from 'next/link'
import { ArrowRight, Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { isBudgetEditable } from '@/lib/finance/budgets'
import type { Currency } from '@/types'
import {
  BUDGET_STATUS_LABELS,
  type Budget,
  type BudgetLine,
  MEMBER_TYPE_LABELS,
} from '@/types'

export interface BudgetFormState {
  name: string
  start_date: string
  end_date: string
  description: string
}

export interface BudgetLineFormState {
  fund_id: string
  line_description: string
  currency: string
  amount: string
  scope_member_id: string
  notes: string
}

function defaultBudgetDates() {
  const now = new Date()
  const year = now.getFullYear()

  return {
    start_date: `${year}-01-01`,
    end_date: `${year}-12-31`,
  }
}

export function emptyBudgetForm(): BudgetFormState {
  const { start_date, end_date } = defaultBudgetDates()

  return {
    name: '',
    start_date,
    end_date,
    description: '',
  }
}

export function emptyLineForm(currency = 'USD'): BudgetLineFormState {
  return {
    fund_id: '',
    line_description: '',
    currency,
    amount: '',
    scope_member_id: '',
    notes: '',
  }
}

export function BudgetStatusBadge({ status }: { status: Budget['status'] }) {
  const variant = status === 'active'
    ? 'green'
    : status === 'closed'
      ? 'yellow'
      : 'default'

  return <Badge variant={variant}>{BUDGET_STATUS_LABELS[status]}</Badge>
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`))
}

export function formatBudgetPeriod(budget: Pick<Budget, 'start_date' | 'end_date'>) {
  return `${formatDateLabel(budget.start_date)} to ${formatDateLabel(budget.end_date)}`
}

export function summarizeBudgetLines(lines: BudgetLine[]) {
  return lines.reduce<Record<string, number>>((acc, line) => {
    if (!acc[line.currency]) acc[line.currency] = 0
    acc[line.currency] += Number(line.amount)
    return acc
  }, {})
}

export function BudgetListView({
  budgets,
  currentBudgetId,
  getBudgetHref,
}: {
  budgets: Budget[]
  currentBudgetId?: string | null
  getBudgetHref: (budget: Budget) => string
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {budgets.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--text-muted)]">No budgets yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[var(--surface-panel-muted)]/70">
                <tr className="border-b [border-color:var(--border-strong)]">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Period</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Planned Spend</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Lines</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {budgets.map((budget) => {
                  const isCurrent = budget.id === currentBudgetId
                  const lineCount = budget.lines?.length ?? 0
                  const summary = summarizeBudgetLines(budget.lines ?? [])

                  return (
                    <tr
                      key={budget.id}
                      className={`border-b last:border-0 [border-color:var(--border-subtle)] ${
                        isCurrent ? 'bg-cyan-500/10' : 'hover:bg-[var(--surface-panel-muted)]'
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                        <Link
                          href={getBudgetHref(budget)}
                          aria-current={isCurrent ? 'page' : undefined}
                          className="hover:text-cyan-300 transition-colors"
                        >
                          {budget.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{formatBudgetPeriod(budget)}</td>
                      <td className="px-4 py-3">
                        <BudgetStatusBadge status={budget.status} />
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--text-secondary)]">
                        {Object.entries(summary).length === 0 ? (
                          <span className="text-[var(--text-muted)]">—</span>
                        ) : (
                          Object.entries(summary).map(([currency, totals]) => (
                            <p key={currency} className="font-medium text-[var(--text-primary)]">
                              {formatCurrency(totals, currency as Currency)}
                            </p>
                          ))
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--text-secondary)]">{lineCount}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={getBudgetHref(budget)}
                          className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-cyan-300 transition-colors"
                        >
                          Open <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function BudgetFormModal({
  open,
  mode,
  form,
  onChange,
  onClose,
  onSave,
  loading,
}: {
  open: boolean
  mode: 'create' | 'edit' | null
  form: BudgetFormState
  onChange: (patch: Partial<BudgetFormState>) => void
  onClose: () => void
  onSave: () => void
  loading: boolean
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'edit' ? 'Edit Budget' : 'New Budget'}
      size="md"
    >
      <div className="space-y-4">
        <Input
          label="Budget name *"
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g. 2026 Annual Budget"
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Start date *"
            type="date"
            value={form.start_date}
            onChange={(e) => onChange({ start_date: e.target.value })}
          />
          <Input
            label="End date *"
            type="date"
            value={form.end_date}
            onChange={(e) => onChange({ end_date: e.target.value })}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-[var(--text-secondary)]">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Optional description"
            rows={4}
            className="w-full rounded-[var(--radius-sm)] border bg-[var(--field-bg)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-[var(--field-shadow)] outline-none transition-[background-color,border-color,box-shadow,color] [border-color:var(--field-border)] hover:[border-color:var(--field-border-hover)] focus:ring-2 focus:ring-[var(--accent-ring)] focus:[border-color:var(--accent-border)]"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={onSave} loading={loading}>
            {mode === 'edit' ? 'Save Budget' : 'Create Draft'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export function BudgetLineModal({
  open,
  mode,
  form,
  fundOptions,
  currencyOptions,
  memberOptions,
  onChange,
  onClose,
  onSave,
  loading,
}: {
  open: boolean
  mode: 'create' | 'edit' | null
  form: BudgetLineFormState
  fundOptions: Array<{ value: string; label: string }>
  currencyOptions: Array<{ value: string; label: string }>
  memberOptions: Array<{ value: string; label: string }>
  onChange: (patch: Partial<BudgetLineFormState>) => void
  onClose: () => void
  onSave: () => void
  loading: boolean
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'edit' ? 'Edit Expense Line' : 'Add Expense Line'}
      size="lg"
    >
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Select
            label="Fund *"
            value={form.fund_id}
            onChange={(e) => onChange({ fund_id: e.target.value })}
            options={fundOptions}
            placeholder="Select fund"
          />
          <Input
            label="Line Description *"
            value={form.line_description}
            onChange={(e) => onChange({ line_description: e.target.value })}
            placeholder="e.g. Fuel, Repairs, Outreach"
          />
          <Select
            label="Currency *"
            value={form.currency}
            onChange={(e) => onChange({ currency: e.target.value })}
            options={currencyOptions}
          />
          <Input
            label="Amount *"
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={(e) => onChange({ amount: e.target.value })}
            placeholder="0.00"
          />
          <Select
            label="Member Scope"
            value={form.scope_member_id}
            onChange={(e) => onChange({ scope_member_id: e.target.value })}
            options={memberOptions}
            placeholder="District-wide"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-[var(--text-secondary)]">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder="Optional notes for this line"
            rows={4}
            className="w-full rounded-[var(--radius-sm)] border bg-[var(--field-bg)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-[var(--field-shadow)] outline-none transition-[background-color,border-color,box-shadow,color] [border-color:var(--field-border)] hover:[border-color:var(--field-border-hover)] focus:ring-2 focus:ring-[var(--accent-ring)] focus:[border-color:var(--accent-border)]"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={onSave} loading={loading}>
            {mode === 'edit' ? 'Save Line' : 'Add Line'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export function BudgetActions({
  budget,
  canManageBudgets,
  canActivateBudgets,
  canCloseBudgets,
  onEditBudget,
  onDeleteBudget,
  onActivateBudget,
  onCloseBudget,
  actionLoading,
}: {
  budget: Budget
  canManageBudgets: boolean
  canActivateBudgets: boolean
  canCloseBudgets: boolean
  onEditBudget: (budget: Budget) => void
  onDeleteBudget: (budget: Budget) => void
  onActivateBudget: (budget: Budget) => void
  onCloseBudget: (budget: Budget) => void
  actionLoading: string | null
}) {
  const isDraft = isBudgetEditable(budget.status)

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canManageBudgets && isDraft && (
        <>
          <Button variant="ghost" size="sm" onClick={() => onEditBudget(budget)}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDeleteBudget(budget)}
            className="text-red-400 hover:text-red-300"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </>
      )}

      {canActivateBudgets && budget.status === 'draft' && (
        <Button
          size="sm"
          onClick={() => onActivateBudget(budget)}
          loading={actionLoading === `activate:${budget.id}`}
        >
          <Check className="h-4 w-4" />
          Activate
        </Button>
      )}

      {canCloseBudgets && budget.status === 'active' && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onCloseBudget(budget)}
          loading={actionLoading === `close:${budget.id}`}
        >
          <X className="h-4 w-4" />
          Close Budget
        </Button>
      )}
    </div>
  )
}

export function BudgetDetailView({
  budget,
  canManageBudgets,
  onAddLine,
  onEditLine,
  onDeleteLine,
}: {
  budget: Budget | null
  canManageBudgets: boolean
  onAddLine: () => void
  onEditLine: (line: BudgetLine) => void
  onDeleteLine: (line: BudgetLine) => void
}) {
  if (!budget) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="border-b px-5 py-4 [border-color:var(--border-strong)]">
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Budget Detail</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Choose a budget to review its lines and totals.
            </p>
          </div>
        </CardHeader>
      </Card>
    )
  }

  const lines = budget.lines ?? []
  const summary = summarizeBudgetLines(lines)
  const isDraft = isBudgetEditable(budget.status)

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-6 p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[var(--radius-md)] border p-4 [border-color:var(--border-strong)]">
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Lines</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{lines.length}</p>
          </div>

          <div className="rounded-[var(--radius-md)] border p-4 [border-color:var(--border-strong)]">
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Planned Expenses</p>
            <div className="mt-2 space-y-1">
              {Object.entries(summary).map(([currency, total]) => (
                <p key={currency} className="text-sm font-medium text-amber-300">
                  {formatCurrency(total, currency as Currency)}
                </p>
              ))}
              {Object.keys(summary).length === 0 && (
                <p className="text-sm text-[var(--text-muted)]">No expense lines</p>
              )}
            </div>
          </div>

          <div className="rounded-[var(--radius-md)] border p-4 [border-color:var(--border-strong)]">
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Scoped Lines</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
              {lines.filter((line) => line.scope_member_id).length}
            </p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {lines.filter((line) => !line.scope_member_id).length} district-wide
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-medium text-[var(--text-primary)]">Expense Lines</h3>
              <p className="text-xs text-[var(--text-muted)]">
                Draft budgets can add or update expense lines. Active and closed budgets stay read-only.
              </p>
            </div>

            {canManageBudgets && isDraft && (
              <Button variant="ghost" size="sm" onClick={onAddLine}>
                <Plus className="h-4 w-4" />
                Add Line
              </Button>
            )}
          </div>

          <div className="overflow-x-auto rounded-[var(--radius-md)] border [border-color:var(--border-strong)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b [border-color:var(--border-strong)]">
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">Fund</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">Line</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">Currency</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">Scope</th>
                  <th className="px-4 py-3 text-right font-medium text-[var(--text-muted)]">Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-muted)]">Notes</th>
                  <th className="w-24 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-[var(--text-muted)]">
                      No expense lines yet.
                    </td>
                  </tr>
                ) : (
                  lines.map((line) => (
                    <tr key={line.id} className="border-b last:border-0 [border-color:var(--border-subtle)]">
                      <td className="px-4 py-3 text-[var(--text-primary)]">{line.fund?.name ?? 'Unknown fund'}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{line.line_description}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{line.currency}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">
                        {line.scope_member
                          ? `${MEMBER_TYPE_LABELS[line.scope_member.type]} - ${line.scope_member.name}`
                          : 'District-wide'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-[var(--text-primary)]">
                        {formatCurrency(Number(line.amount), line.currency)}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{line.notes ?? '-'}</td>
                      <td className="px-4 py-3">
                        {canManageBudgets && isDraft ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => onEditLine(line)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onDeleteLine(line)}
                              className="text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
