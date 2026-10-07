'use client'

import { useState, type FormEvent } from 'react'
import { Building2, Landmark, Pencil, Plus, UserPlus, X } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { PageSpinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { SelectDistrictHint } from '@/components/layout/SelectDistrictHint'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { useDepartments, type DepartmentInput, type RosterPerson } from '@/hooks/useDepartments'
import { ROLE_LABELS } from '@/lib/auth/permissions'
import type { Department } from '@/types'

const TITLE = 'Departments'
const DESCRIPTION = 'Function-based teams such as Building, Functions, Properties and Finance.'

const EMPTY_FORM: DepartmentInput = {
  name: '',
  code: null,
  description: null,
  grants_finance_view: false,
  is_active: true,
}

function personName(person: RosterPerson) {
  return person.display_name || person.email || 'Unknown user'
}

export function DepartmentsPage() {
  const { districtId } = useAuth()
  const { can } = usePermissions()
  const toast = useToast()
  const { data: departments, roster, loading, error, add, update, addMember, removeMember } = useDepartments(districtId)

  const canManage = can('departments.manage')
  // Only the District Pastor decides which department is the Finance Committee.
  const canGrantFinance = can('district.settings.manage')

  const [dialog, setDialog] = useState<{ kind: 'create' } | { kind: 'edit'; department: Department } | null>(null)
  const [form, setForm] = useState<DepartmentInput>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState<Record<string, string>>({})
  const [busyMember, setBusyMember] = useState<string | null>(null)

  if (!districtId) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <PageHeader title={TITLE} description={DESCRIPTION} />
        <SelectDistrictHint description="Choose a district to see its departments." />
      </div>
    )
  }

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setDialog({ kind: 'create' })
  }

  const openEdit = (department: Department) => {
    setForm({
      name: department.name,
      code: department.code,
      description: department.description,
      grants_finance_view: department.grants_finance_view,
      is_active: department.is_active,
    })
    setDialog({ kind: 'edit', department })
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('Name is required')
      return
    }
    const values: DepartmentInput = {
      ...form,
      name: form.name.trim(),
      code: form.code?.trim() || null,
      description: form.description?.trim() || null,
    }
    setSaving(true)
    try {
      if (dialog?.kind === 'edit') {
        await update(dialog.department.id, values)
        toast.success('Department updated')
      } else {
        await add(values)
        toast.success(`${values.name} added`)
      }
      setDialog(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleAddMember = async (departmentId: string) => {
    const userId = adding[departmentId]
    if (!userId) return
    setBusyMember(`${departmentId}:${userId}`)
    try {
      await addMember(departmentId, userId)
      setAdding((current) => ({ ...current, [departmentId]: '' }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusyMember(null)
    }
  }

  const handleRemoveMember = async (departmentId: string, userId: string) => {
    setBusyMember(`${departmentId}:${userId}`)
    try {
      await removeMember(departmentId, userId)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusyMember(null)
    }
  }

  const sorted = [...departments].sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name))

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <PageHeader
        title={TITLE}
        description={DESCRIPTION}
        actions={canManage ? (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add department
          </Button>
        ) : undefined}
      />

      {loading ? (
        <PageSpinner />
      ) : error ? (
        <Card><CardContent><p className="text-sm text-red-400">{error}</p></CardContent></Card>
      ) : sorted.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Building2 className="h-8 w-8 text-[var(--text-muted)]" />
            <p className="text-sm text-[var(--text-tertiary)]">
              No departments yet.{canManage ? ' Add Building, Functions, Properties or Finance to get started.' : ''}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sorted.map((department) => {
            const leaders = roster.leaders.filter((l) => l.department_id === department.id)
            const leaderIds = new Set(leaders.map((l) => l.user_id))
            const members = roster.members.filter((m) => m.department_id === department.id && !leaderIds.has(m.user_id))
            const memberIds = new Set(members.map((m) => m.user_id))
            const canManageMembers = roster.manageable_department_ids.includes(department.id)
            const candidates = roster.people
              .filter((p) => !leaderIds.has(p.user_id) && !memberIds.has(p.user_id))
              .map((p) => ({ value: p.user_id, label: personName(p) }))

            return (
              <Card key={department.id} className={department.is_active ? '' : 'opacity-60'}>
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle>{department.name}</CardTitle>
                      {department.code && <Badge>{department.code}</Badge>}
                      {department.grants_finance_view && (
                        <Badge variant="teal">
                          <Landmark className="mr-1 inline h-3 w-3" />
                          Finance Committee
                        </Badge>
                      )}
                      {!department.is_active && <Badge>Inactive</Badge>}
                    </div>
                    {department.description && <CardDescription>{department.description}</CardDescription>}
                  </div>
                  {canManage && (
                    <Button variant="ghost" size="sm" onClick={() => openEdit(department)} aria-label={`Edit ${department.name}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    {(['departmental_chairperson', 'departmental_secretary'] as const).map((leaderRole) => {
                      const holders = leaders.filter((l) => l.role === leaderRole)
                      return (
                        <div key={leaderRole}>
                          <dt className="text-xs text-[var(--text-tertiary)]">{ROLE_LABELS[leaderRole].replace('Departmental ', '')}</dt>
                          <dd className="text-[var(--text-primary)]">
                            {holders.length ? holders.map(personName).join(', ') : <span className="text-[var(--text-muted)]">Not assigned</span>}
                          </dd>
                        </div>
                      )
                    })}
                  </dl>

                  <div className="space-y-2">
                    <p className="text-xs text-[var(--text-tertiary)]">Members</p>
                    {members.length === 0 ? (
                      <p className="text-sm text-[var(--text-muted)]">No other members.</p>
                    ) : (
                      <ul className="flex flex-wrap gap-2">
                        {members.map((m) => (
                          <li key={m.user_id}>
                            <Badge className="gap-1">
                              {personName(m)}
                              {canManageMembers && (
                                <button
                                  type="button"
                                  className="ml-1 rounded-sm hover:text-[var(--text-primary)] disabled:opacity-50"
                                  aria-label={`Remove ${personName(m)}`}
                                  disabled={busyMember === `${department.id}:${m.user_id}`}
                                  onClick={() => void handleRemoveMember(department.id, m.user_id)}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                    {canManageMembers && candidates.length > 0 && (
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <Select
                            aria-label={`Add a member to ${department.name}`}
                            value={adding[department.id] ?? ''}
                            options={candidates}
                            placeholder="Add a member…"
                            onChange={(e) => setAdding((current) => ({ ...current, [department.id]: e.target.value }))}
                          />
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={!adding[department.id]}
                          loading={busyMember === `${department.id}:${adding[department.id]}`}
                          onClick={() => void handleAddMember(department.id)}
                        >
                          <UserPlus className="h-4 w-4" />
                          Add
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <p className="text-xs text-[var(--text-tertiary)]">
        Chairpersons and secretaries are assigned in Settings → Users &amp; roles.
      </p>

      <Modal
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={dialog?.kind === 'edit' ? 'Edit department' : 'Add department'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            id="department-name"
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Properties"
            autoFocus
          />
          <Input
            id="department-code"
            label="Code (optional)"
            value={form.code ?? ''}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
          />
          <div className="flex flex-col gap-1">
            <label htmlFor="department-description" className="text-sm font-medium text-[var(--text-secondary)]">
              Description (optional)
            </label>
            <textarea
              id="department-description"
              rows={3}
              value={form.description ?? ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-sm border bg-[var(--field-bg)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-[var(--field-shadow)] outline-none [border-color:var(--field-border)] hover:[border-color:var(--field-border-hover)] focus:ring-2 focus:ring-[var(--accent-ring)] focus:[border-color:var(--accent-border)]"
            />
          </div>
          {canGrantFinance && (
            <label className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={form.grants_finance_view}
                onChange={(e) => setForm({ ...form, grants_finance_view: e.target.checked })}
                className="mt-0.5 h-4 w-4 accent-[var(--accent-solid)]"
              />
              <span>
                Finance Committee
                <span className="block text-xs text-[var(--text-tertiary)]">
                  Members can view all financials and collections. They cannot post.
                </span>
              </span>
            </label>
          )}
          {dialog?.kind === 'edit' && (
            <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="h-4 w-4 accent-[var(--accent-solid)]"
              />
              Active
            </label>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setDialog(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {dialog?.kind === 'edit' ? 'Save changes' : 'Add department'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
