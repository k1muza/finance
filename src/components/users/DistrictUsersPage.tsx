'use client'

import { useState, type FormEvent } from 'react'
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
import { SelectDistrictHint } from '@/components/layout/SelectDistrictHint'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { useDistrictUsers, type DistrictUser } from '@/hooks/useDistrictUsers'
import {
  DISTRICT_ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  type DistrictRole,
} from '@/lib/auth/permissions'

const TITLE = 'Users & roles'
const DESCRIPTION = 'Add people to this district and choose what they can do. Promote someone to District Admin to let them manage users.'

const ROLE_OPTIONS = DISTRICT_ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }))

type PendingChange =
  | { kind: 'role'; user: DistrictUser; role: DistrictRole }
  | { kind: 'deactivate'; user: DistrictUser }

function displayName(user: DistrictUser) {
  return user.display_name || user.email || 'Unknown user'
}

export function DistrictUsersPage() {
  const { districtId, user: currentUser } = useAuth()
  const { can } = usePermissions()
  const canManage = can('district.users.manage')
  const toast = useToast()
  const { data: users, loading, error, add, update } = useDistrictUsers(districtId, canManage)

  const [addOpen, setAddOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<DistrictRole>('viewer')
  const [adding, setAdding] = useState(false)
  const [pending, setPending] = useState<PendingChange | null>(null)
  const [savingUserId, setSavingUserId] = useState<string | null>(null)

  if (!districtId) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <PageHeader title={TITLE} description={DESCRIPTION} />
        <SelectDistrictHint description="Choose a district to manage its users." />
      </div>
    )
  }

  if (!canManage) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <PageHeader title={TITLE} description={DESCRIPTION} />
        <SelectDistrictHint
          title="District admins only"
          description="Ask a District Admin to add users or change roles."
        />
      </div>
    )
  }

  const activeAdminCount = users.filter((u) => u.is_active && u.role === 'admin').length
  const sortedUsers = [...users].sort((a, b) => Number(b.is_active) - Number(a.is_active))

  const applyChange = async (change: PendingChange) => {
    setSavingUserId(change.user.user_id)
    try {
      if (change.kind === 'role') {
        await update(change.user.user_id, { role: change.role })
        toast.success(`${displayName(change.user)} is now ${ROLE_LABELS[change.role]}`)
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

  const requestRoleChange = (target: DistrictUser, nextRole: DistrictRole) => {
    if (nextRole === target.role) return
    const change: PendingChange = { kind: 'role', user: target, role: nextRole }
    // Changing your own role can lock you out of this page, so confirm first.
    if (target.user_id === currentUser?.id) setPending(change)
    else void applyChange(change)
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

  const closeAdd = () => {
    setAddOpen(false)
    setEmail('')
    setRole('viewer')
  }

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault()
    if (!email.trim()) {
      toast.error('Email is required')
      return
    }
    setAdding(true)
    try {
      await add(email, role)
      toast.success(`Added ${email.trim()} as ${ROLE_LABELS[role]}`)
      closeAdd()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setAdding(false)
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

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PageHeader
        title={TITLE}
        description={DESCRIPTION}
        actions={(
          <Button onClick={() => setAddOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Add user
          </Button>
        )}
      />

      <Card>
        <CardHeader className="border-b [border-color:var(--border-subtle)]">
          <CardTitle>People with access</CardTitle>
          <CardDescription>
            {activeAdminCount === 1
              ? 'This district has one admin. Promote a second person so you are never locked out.'
              : `${activeAdminCount} district admins.`}
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
              const isLastAdmin = u.is_active && u.role === 'admin' && activeAdminCount <= 1
              const saving = savingUserId === u.user_id
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
                    {u.role === 'admin' && u.is_active && (
                      <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--accent-solid)]" aria-label="Admin" />
                    )}
                    <div className="w-48">
                      <Select
                        aria-label={`Role for ${displayName(u)}`}
                        value={u.role}
                        options={ROLE_OPTIONS}
                        disabled={saving || !u.is_active || isLastAdmin}
                        title={isLastAdmin ? 'Promote another admin before changing this role' : undefined}
                        onChange={(e) => requestRoleChange(u, e.target.value as DistrictRole)}
                      />
                    </div>
                    {u.is_active ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={saving || isLastAdmin}
                        title={isLastAdmin ? 'Promote another admin before removing this one' : undefined}
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

      <Modal open={addOpen} onClose={closeAdd} title="Add user">
        <form onSubmit={handleAdd} className="space-y-4">
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
          <div className="space-y-1">
            <Select
              id="add-user-role"
              label="Role"
              value={role}
              options={ROLE_OPTIONS}
              onChange={(e) => setRole(e.target.value as DistrictRole)}
            />
            <p className="text-xs text-[var(--text-tertiary)]">{ROLE_DESCRIPTIONS[role]}</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={closeAdd} disabled={adding}>
              Cancel
            </Button>
            <Button type="submit" loading={adding}>
              Add user
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
