'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { ShieldCheck, UserPlus } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { PageSpinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { useDepartments } from '@/hooks/useDepartments'
import { useDistrictUsers, type DistrictUser } from '@/hooks/useDistrictUsers'
import { useMembers } from '@/hooks/useMembers'
import type { RoleScope } from '@/lib/auth/district-users'
import {
  DISTRICT_ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  roleScopeKind,
  SCOPE_KIND_LABELS,
  type DistrictRole,
  type RoleScopeKind,
} from '@/lib/auth/permissions'

const TITLE = 'Users & roles'
const DESCRIPTION = 'Add people to this district and choose what they can do. District Pastors and Accounting Officers can manage users.'

const ROLE_OPTIONS = DISTRICT_ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }))

type PendingChange =
  | { kind: 'role'; user: DistrictUser; role: DistrictRole; scope: RoleScope }
  | { kind: 'deactivate'; user: DistrictUser }

/** The add-user form and the change-role form share one dialog. */
type RoleDialog = { kind: 'add' } | { kind: 'edit'; user: DistrictUser }

function displayName(user: DistrictUser) {
  return user.display_name || user.email || 'Unknown user'
}

function scopeFor(role: DistrictRole, scopeId: string): RoleScope {
  const kind = roleScopeKind(role)
  return {
    scope_member_id: kind && kind !== 'department' ? scopeId || null : null,
    scope_department_id: kind === 'department' ? scopeId || null : null,
  }
}

/** Settings → Users & roles. Access is checked by SettingsSectionGate. */
export function UsersSettings() {
  const { districtId, user: currentUser } = useAuth()
  const { can } = usePermissions()
  const canManage = can('district.users.manage')
  const toast = useToast()
  const { data: users, loading, error, add, update } = useDistrictUsers(districtId, canManage)
  const { data: units } = useMembers({ district_id: districtId })
  const { data: departments } = useDepartments(districtId, { withRoster: false })

  const [dialog, setDialog] = useState<RoleDialog | null>(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<DistrictRole>('district_secretary')
  const [scopeId, setScopeId] = useState('')
  const [saving, setSaving] = useState(false)
  const [pending, setPending] = useState<PendingChange | null>(null)
  const [savingUserId, setSavingUserId] = useState<string | null>(null)

  const scopeOptions = useMemo(() => {
    const byKind: Record<RoleScopeKind, { value: string; label: string }[]> = {
      region: [],
      assembly: [],
      ministry: [],
      department: departments.filter((d) => d.is_active).map((d) => ({ value: d.id, label: d.name })),
    }
    for (const unit of units) {
      if (!unit.is_active) continue
      const option = { value: unit.id, label: unit.name }
      if (unit.type === 'region') byKind.region.push(option)
      else if (unit.type === 'assembly') byKind.assembly.push(option)
      else if (unit.type === 'department') byKind.ministry.push(option)
    }
    return byKind
  }, [units, departments])

  const scopeName = (u: DistrictUser) => {
    if (u.scope_department_id) return departments.find((d) => d.id === u.scope_department_id)?.name ?? null
    if (u.scope_member_id) return units.find((m) => m.id === u.scope_member_id)?.name ?? null
    return null
  }

  const activePastorCount = users.filter((u) => u.is_active && u.role === 'district_pastor').length
  const sortedUsers = [...users].sort((a, b) => Number(b.is_active) - Number(a.is_active))
  const scopeKind = roleScopeKind(role)

  const applyChange = async (change: PendingChange) => {
    setSavingUserId(change.user.user_id)
    try {
      if (change.kind === 'role') {
        await update(change.user.user_id, { role: change.role, ...change.scope })
        toast.success(`${displayName(change.user)} is now ${ROLE_LABELS[change.role]}`)
        setDialog(null)
      } else {
        await update(change.user.user_id, { is_active: false })
        toast.success(`${displayName(change.user)} no longer has access`)
      }
      setPending(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setSavingUserId(null)
    }
  }

  const reactivate = async (target: DistrictUser) => {
    setSavingUserId(target.user_id)
    try {
      await update(target.user_id, { is_active: true })
      toast.success(`${displayName(target)} has access again`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setSavingUserId(null)
    }
  }

  const openAdd = () => {
    setEmail('')
    setRole('district_secretary')
    setScopeId('')
    setDialog({ kind: 'add' })
  }

  const openEdit = (target: DistrictUser) => {
    setRole(target.role)
    setScopeId(target.scope_department_id ?? target.scope_member_id ?? '')
    setDialog({ kind: 'edit', user: target })
  }

  const changeRole = (next: DistrictRole) => {
    // Keep the chosen unit only while the kind of unit stays the same.
    if (roleScopeKind(next) !== roleScopeKind(role)) setScopeId('')
    setRole(next)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (scopeKind && !scopeId) {
      toast.error(`Choose a ${SCOPE_KIND_LABELS[scopeKind].toLowerCase()} for ${ROLE_LABELS[role]}`)
      return
    }
    const scope = scopeFor(role, scopeId)

    if (dialog?.kind === 'edit') {
      const change: PendingChange = { kind: 'role', user: dialog.user, role, scope }
      // Changing your own role can lock you out of this page, so confirm first.
      if (dialog.user.user_id === currentUser?.id) setPending(change)
      else void applyChange(change)
      return
    }

    if (!email.trim()) {
      toast.error('Email is required')
      return
    }
    setSaving(true)
    try {
      await add(email, role, scope)
      toast.success(`Added ${email.trim()} as ${ROLE_LABELS[role]}`)
      setDialog(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const confirmCopy = (() => {
    if (!pending) return { title: '', message: '', label: '' }
    if (pending.kind === 'deactivate') {
      const self = pending.user.user_id === currentUser?.id
      return {
        title: 'Remove access?',
        message: self
          ? 'You will lose access to this district immediately.'
          : `${displayName(pending.user)} will lose access to this district. You can restore it later.`,
        label: 'Remove access',
      }
    }
    return {
      title: 'Change your own role?',
      message: `You will become ${ROLE_LABELS[pending.role]}. If that role can't manage users, you won't be able to change it back.`,
      label: 'Change role',
    }
  })()

  const editingUser = dialog?.kind === 'edit' ? dialog.user : null
  const editingLastPastor = Boolean(
    editingUser?.is_active && editingUser.role === 'district_pastor' && activePastorCount <= 1,
  )

  return (
    <div className="space-y-6">
      <PageHeader
        size="md"
        title={TITLE}
        description={DESCRIPTION}
        actions={(
          <Button onClick={openAdd}>
            <UserPlus className="h-4 w-4" />
            Add user
          </Button>
        )}
      />

      <Card>
        <CardHeader className="border-b [border-color:var(--border-subtle)]">
          <CardTitle>People with access</CardTitle>
          <CardDescription>
            {activePastorCount === 1
              ? 'This district has one District Pastor. Assign a second so you are never locked out.'
              : `${activePastorCount} District Pastors.`}
          </CardDescription>
        </CardHeader>
        {loading ? (
          <PageSpinner />
        ) : error ? (
          <CardContent>
            <p className="text-sm text-red-400">{error}</p>
          </CardContent>
        ) : sortedUsers.length === 0 ? (
          <CardContent>
            <p className="text-sm text-[var(--text-tertiary)]">No users yet.</p>
          </CardContent>
        ) : (
          <ul className="divide-y [&>li]:[border-color:var(--border-subtle)]">
            {sortedUsers.map((u) => {
              const isSelf = u.user_id === currentUser?.id
              const isLastPastor = u.is_active && u.role === 'district_pastor' && activePastorCount <= 1
              const saving = savingUserId === u.user_id
              const unit = scopeName(u)
              return (
                <li
                  key={u.user_id}
                  className={`flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-3 ${u.is_active ? '' : 'opacity-60'}`}
                >
                  <div className="min-w-0 flex-1 basis-56">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-[var(--text-primary)]">{displayName(u)}</p>
                      {isSelf && <Badge variant="teal">You</Badge>}
                      {!u.is_active && <Badge>No access</Badge>}
                    </div>
                    {u.display_name && u.email && (
                      <p className="truncate text-xs text-[var(--text-tertiary)]">{u.email}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {u.role === 'district_pastor' && u.is_active && (
                      <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--accent-solid)]" aria-label="District Pastor" />
                    )}
                    <div className="w-56 text-right sm:text-left">
                      <p className="text-sm text-[var(--text-primary)]">{ROLE_LABELS[u.role] ?? u.role}</p>
                      {roleScopeKind(u.role) && (
                        <p className="truncate text-xs text-[var(--text-tertiary)]">
                          {unit ?? `No ${SCOPE_KIND_LABELS[roleScopeKind(u.role)!].toLowerCase()} set`}
                        </p>
                      )}
                    </div>
                    {u.is_active && (
                      <Button variant="secondary" size="sm" disabled={saving} onClick={() => openEdit(u)}>
                        Change role
                      </Button>
                    )}
                    {u.is_active ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={saving || isLastPastor}
                        title={isLastPastor ? 'Assign another District Pastor before removing this one' : undefined}
                        onClick={() => setPending({ kind: 'deactivate', user: u })}
                      >
                        Remove access
                      </Button>
                    ) : (
                      <Button variant="secondary" size="sm" loading={saving} onClick={() => void reactivate(u)}>
                        Restore access
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What each role can do</CardTitle>
          <CardDescription>
            Members of the Finance Committee department can also view all financials and collections, whatever their role.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <dl className="grid gap-3 sm:grid-cols-2">
            {DISTRICT_ROLES.map((r) => (
              <div key={r}>
                <dt className="text-sm font-medium text-[var(--text-primary)]">{ROLE_LABELS[r]}</dt>
                <dd className="text-sm text-[var(--text-tertiary)]">{ROLE_DESCRIPTIONS[r]}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Modal
        open={dialog !== null && pending === null}
        onClose={() => setDialog(null)}
        title={editingUser ? `Change role for ${displayName(editingUser)}` : 'Add user'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editingUser && (
            <>
              <Input
                id="add-user-email"
                label="Email"
                type="email"
                autoComplete="off"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
              <p className="-mt-2 text-xs text-[var(--text-tertiary)]">
                They need to have signed up already.
              </p>
            </>
          )}
          <div className="space-y-1">
            <Select
              id="user-role"
              label="Role"
              value={role}
              options={ROLE_OPTIONS}
              disabled={editingLastPastor}
              title={editingLastPastor ? 'Assign another District Pastor before changing this role' : undefined}
              onChange={(e) => changeRole(e.target.value as DistrictRole)}
            />
            <p className="text-xs text-[var(--text-tertiary)]">{ROLE_DESCRIPTIONS[role]}</p>
          </div>
          {scopeKind && (
            <div className="space-y-1">
              <Select
                id="user-scope"
                label={SCOPE_KIND_LABELS[scopeKind]}
                value={scopeId}
                options={scopeOptions[scopeKind]}
                placeholder={`Choose a ${SCOPE_KIND_LABELS[scopeKind].toLowerCase()}…`}
                onChange={(e) => setScopeId(e.target.value)}
              />
              {scopeOptions[scopeKind].length === 0 && (
                <p className="text-xs text-[var(--text-tertiary)]">
                  {scopeKind === 'department'
                    ? 'No departments yet — add them under Coordination → Departments.'
                    : `No ${SCOPE_KIND_LABELS[scopeKind].toLowerCase()}s yet — add them under People.`}
                </p>
              )}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setDialog(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" loading={saving || (editingUser !== null && savingUserId === editingUser.user_id)}>
              {editingUser ? 'Save role' : 'Add user'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={() => pending && void applyChange(pending)}
        title={confirmCopy.title}
        message={confirmCopy.message}
        confirmLabel={confirmCopy.label}
        loading={pending !== null && savingUserId === pending.user.user_id}
      />
    </div>
  )
}
