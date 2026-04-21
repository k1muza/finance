'use client'

import { useState, type ElementType } from 'react'
import {
  User,
  Church,
  MapPin,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Briefcase,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { useMembers } from '@/hooks/useMembers'
import { useCounterparties } from '@/hooks/useCounterparties'
import { SelectDistrictHint } from '@/components/layout/SelectDistrictHint'
import {
  Counterparty,
  CounterpartyType,
  COUNTERPARTY_TYPE_LABELS,
  IndividualTitle,
  INDIVIDUAL_TITLE_LABELS,
  Member,
  MemberType,
} from '@/types'

type DirectoryTab = 'regions' | 'assemblies' | 'individuals' | 'counterparties'

const TABS: Array<{
  key: DirectoryTab
  label: string
  icon: ElementType
  memberType?: MemberType
}> = [
  { key: 'regions', label: 'Regions', icon: MapPin, memberType: 'region' },
  { key: 'assemblies', label: 'Assemblies', icon: Church, memberType: 'assembly' },
  { key: 'individuals', label: 'Individuals', icon: User, memberType: 'individual' },
  { key: 'counterparties', label: 'Counterparties', icon: Briefcase },
]

interface MemberFormState {
  name: string
  code: string
  title: IndividualTitle
  phone: string
  email: string
  address: string
  parent_id: string
}

interface CounterpartyFormState {
  type: CounterpartyType
  name: string
  code: string
  phone: string
  email: string
  address: string
}

const emptyMemberForm = (): MemberFormState => ({
  name: '',
  code: '',
  title: 'saint',
  phone: '',
  email: '',
  address: '',
  parent_id: '',
})

const emptyCounterpartyForm = (): CounterpartyFormState => ({
  type: 'supplier',
  name: '',
  code: '',
  phone: '',
  email: '',
  address: '',
})

function MemberTable({
  memberType,
  members,
  loading,
  parentOptions,
  showParentColumn,
  showTitle,
  parentLabel,
  onAdd,
  onUpdate,
  onDelete,
}: {
  memberType: MemberType
  members: Member[]
  loading: boolean
  parentOptions: Array<{ value: string; label: string }>
  showParentColumn: boolean
  showTitle: boolean
  parentLabel: string
  onAdd: (values: MemberFormState) => Promise<void>
  onUpdate: (id: string, values: MemberFormState) => Promise<void>
  onDelete: (member: Member) => void
}) {
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<MemberFormState>(emptyMemberForm())

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<MemberFormState>(emptyMemberForm())
  const [editSaving, setEditSaving] = useState(false)

  const toast = useToast()

  const typeItems = members.filter((member) => member.type === memberType)
  const titleOptions = (Object.entries(INDIVIDUAL_TITLE_LABELS) as [IndividualTitle, string][])
    .map(([value, label]) => ({ value, label }))

  const labels: Record<MemberType, { namePlaceholder: string; emptyText: string }> = {
    district: { namePlaceholder: '', emptyText: '' },
    region: { namePlaceholder: 'e.g. Greater Accra Region', emptyText: 'No regions yet.' },
    assembly: { namePlaceholder: 'e.g. Accra Central Assembly', emptyText: 'No assemblies yet.' },
    individual: { namePlaceholder: 'e.g. John Mensah', emptyText: 'No individuals yet.' },
    department: { namePlaceholder: 'e.g. Welfare Department', emptyText: 'No departments yet.' },
  }

  const handleAdd = async () => {
    if (!form.name.trim()) {
      toast.error('Name is required')
      return
    }

    setSaving(true)
    try {
      await onAdd(form)
      setForm(emptyMemberForm())
      setAdding(false)
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (member: Member) => {
    setEditingId(member.id)
    setEditForm({
      name: member.name,
      code: member.code ?? '',
      title: member.title ?? 'saint',
      phone: member.phone ?? '',
      email: member.email ?? '',
      address: member.address ?? '',
      parent_id: member.parent_id ?? '',
    })
  }

  const handleUpdate = async (id: string) => {
    if (!editForm.name.trim()) {
      toast.error('Name is required')
      return
    }

    setEditSaving(true)
    try {
      await onUpdate(id, editForm)
      setEditingId(null)
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {adding && (
        <Card>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {showTitle && (
                <Select
                  label="Title"
                  value={form.title}
                  onChange={(e) => setForm((current) => ({ ...current, title: e.target.value as IndividualTitle }))}
                  options={titleOptions}
                />
              )}
              <Input
                label="Name *"
                value={form.name}
                onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                placeholder={labels[memberType].namePlaceholder}
              />
              {parentOptions.length > 0 && (
                <Select
                  label={parentLabel}
                  value={form.parent_id}
                  onChange={(e) => setForm((current) => ({ ...current, parent_id: e.target.value }))}
                  placeholder={`No ${parentLabel.toLowerCase()}`}
                  options={parentOptions}
                />
              )}
              <Input
                label="Phone"
                value={form.phone}
                onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))}
                placeholder="Optional"
              />
              <Input
                label="Email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
                placeholder="Optional"
              />
              <Input
                label="Address"
                value={form.address}
                onChange={(e) => setForm((current) => ({ ...current, address: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAdding(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleAdd} loading={saving}>
                Save
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader className="flex items-center justify-between border-b px-5 py-3 [border-color:var(--border-strong)]">
          <span className="text-xs text-[var(--text-muted)]">
            {typeItems.length} {typeItems.length === 1 ? 'record' : 'records'}
          </span>
          {!adding && (
            <Button variant="ghost" size="sm" onClick={() => { setAdding(true); setForm(emptyMemberForm()) }}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          )}
        </CardHeader>

        {loading ? (
          <div className="px-5 py-8 text-sm text-[var(--text-muted)]">Loading...</div>
        ) : typeItems.length === 0 ? (
          <div className="px-5 py-8 text-sm text-[var(--text-muted)]">{labels[memberType].emptyText}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b [border-color:var(--border-strong)]">
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-tertiary)]">Name</th>
                  {showParentColumn && (
                    <th className="px-4 py-3 text-left font-medium text-[var(--text-tertiary)]">{parentLabel}</th>
                  )}
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-tertiary)]">Contact</th>
                  <th className="w-20 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {typeItems.map((member) => {
                  const isEditing = editingId === member.id
                  const parentName = parentOptions.find((option) => option.value === member.parent_id)?.label ?? null

                  return (
                    <tr
                      key={member.id}
                      className={`border-b [border-color:var(--border-subtle)] last:border-0 ${isEditing ? 'bg-[var(--surface-panel-muted)]' : ''}`}
                    >
                      <td className="min-w-[200px] px-4 py-3 align-top">
                        {isEditing ? (
                          <div className="space-y-2">
                            {showTitle && (
                              <Select
                                value={editForm.title}
                                onChange={(e) => setEditForm((current) => ({ ...current, title: e.target.value as IndividualTitle }))}
                                options={titleOptions}
                              />
                            )}
                            <Input
                              value={editForm.name}
                              onChange={(e) => setEditForm((current) => ({ ...current, name: e.target.value }))}
                              placeholder="Name"
                            />
                          </div>
                        ) : (
                          <div>
                            <p className="font-medium text-[var(--text-primary)]">
                              {showTitle && member.title && member.title !== 'saint' && (
                                <span className="mr-1 font-semibold text-[var(--theme-accent-400)]">
                                  {INDIVIDUAL_TITLE_LABELS[member.title]}
                                </span>
                              )}
                              {member.name}
                            </p>
                            {!member.is_active && (
                              <span className="text-xs italic text-[var(--text-muted)]">Inactive</span>
                            )}
                          </div>
                        )}
                      </td>
                      {showParentColumn && (
                        <td className="min-w-[180px] px-4 py-3 align-top">
                          {isEditing ? (
                            <Select
                              value={editForm.parent_id}
                              onChange={(e) => setEditForm((current) => ({ ...current, parent_id: e.target.value }))}
                              placeholder={`No ${parentLabel.toLowerCase()}`}
                              options={parentOptions.filter((option) => option.value !== member.id)}
                            />
                          ) : (
                            <span className={parentName ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'}>
                              {parentName ?? '-'}
                            </span>
                          )}
                        </td>
                      )}
                      <td className="min-w-[180px] px-4 py-3 align-top">
                        {isEditing ? (
                          <div className="space-y-2">
                            <Input
                              value={editForm.phone}
                              onChange={(e) => setEditForm((current) => ({ ...current, phone: e.target.value }))}
                              placeholder="Phone"
                            />
                            <Input
                              value={editForm.email}
                              onChange={(e) => setEditForm((current) => ({ ...current, email: e.target.value }))}
                              placeholder="Email"
                            />
                            <Input
                              value={editForm.address}
                              onChange={(e) => setEditForm((current) => ({ ...current, address: e.target.value }))}
                              placeholder="Address"
                            />
                          </div>
                        ) : (
                          <span className="text-[var(--text-tertiary)]">
                            {[member.phone, member.email].filter(Boolean).join(' | ') || '-'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleUpdate(member.id)}
                              disabled={editSaving}
                              className="text-emerald-400 hover:text-emerald-300"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} disabled={editSaving}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => startEdit(member)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onDelete(member)}
                              className="text-red-400 hover:text-red-300"
                            >
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
      </Card>
    </div>
  )
}

function CounterpartyTable({
  counterparties,
  loading,
  onAdd,
  onUpdate,
  onDelete,
}: {
  counterparties: Counterparty[]
  loading: boolean
  onAdd: (values: CounterpartyFormState) => Promise<void>
  onUpdate: (id: string, values: CounterpartyFormState) => Promise<void>
  onDelete: (counterparty: Counterparty) => void
}) {
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<CounterpartyFormState>(emptyCounterpartyForm())

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<CounterpartyFormState>(emptyCounterpartyForm())
  const [editSaving, setEditSaving] = useState(false)

  const toast = useToast()
  const counterpartyTypeOptions = (Object.entries(COUNTERPARTY_TYPE_LABELS) as [CounterpartyType, string][])
    .map(([value, label]) => ({ value, label }))

  const handleAdd = async () => {
    if (!form.name.trim()) {
      toast.error('Name is required')
      return
    }

    setSaving(true)
    try {
      await onAdd(form)
      setForm(emptyCounterpartyForm())
      setAdding(false)
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (counterparty: Counterparty) => {
    setEditingId(counterparty.id)
    setEditForm({
      type: counterparty.type,
      name: counterparty.name,
      code: counterparty.code ?? '',
      phone: counterparty.phone ?? '',
      email: counterparty.email ?? '',
      address: counterparty.address ?? '',
    })
  }

  const handleUpdate = async (id: string) => {
    if (!editForm.name.trim()) {
      toast.error('Name is required')
      return
    }

    setEditSaving(true)
    try {
      await onUpdate(id, editForm)
      setEditingId(null)
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {adding && (
        <Card>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Select
                label="Type"
                value={form.type}
                onChange={(e) => setForm((current) => ({ ...current, type: e.target.value as CounterpartyType }))}
                options={counterpartyTypeOptions}
              />
              <Input
                label="Name *"
                value={form.name}
                onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                placeholder="e.g. Stationery Shop"
              />
              <Input
                label="Phone"
                value={form.phone}
                onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))}
                placeholder="Optional"
              />
              <Input
                label="Email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
                placeholder="Optional"
              />
              <Input
                label="Address"
                value={form.address}
                onChange={(e) => setForm((current) => ({ ...current, address: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAdding(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleAdd} loading={saving}>
                Save
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader className="flex items-center justify-between border-b px-5 py-3 [border-color:var(--border-strong)]">
          <span className="text-xs text-[var(--text-muted)]">
            {counterparties.length} {counterparties.length === 1 ? 'record' : 'records'}
          </span>
          {!adding && (
            <Button variant="ghost" size="sm" onClick={() => { setAdding(true); setForm(emptyCounterpartyForm()) }}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          )}
        </CardHeader>

        {loading ? (
          <div className="px-5 py-8 text-sm text-[var(--text-muted)]">Loading...</div>
        ) : counterparties.length === 0 ? (
          <div className="px-5 py-8 text-sm text-[var(--text-muted)]">No counterparties yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b [border-color:var(--border-strong)]">
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-tertiary)]">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-tertiary)]">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--text-tertiary)]">Contact</th>
                  <th className="w-20 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {counterparties.map((counterparty) => {
                  const isEditing = editingId === counterparty.id

                  return (
                    <tr
                      key={counterparty.id}
                      className={`border-b [border-color:var(--border-subtle)] last:border-0 ${isEditing ? 'bg-[var(--surface-panel-muted)]' : ''}`}
                    >
                      <td className="min-w-[220px] px-4 py-3 align-top">
                        {isEditing ? (
                          <Input
                            value={editForm.name}
                            onChange={(e) => setEditForm((current) => ({ ...current, name: e.target.value }))}
                            placeholder="Name"
                          />
                        ) : (
                          <div>
                            <p className="font-medium text-[var(--text-primary)]">{counterparty.name}</p>
                            {!counterparty.is_active && (
                              <span className="text-xs italic text-[var(--text-muted)]">Inactive</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="min-w-[160px] px-4 py-3 align-top">
                        {isEditing ? (
                          <Select
                            value={editForm.type}
                            onChange={(e) => setEditForm((current) => ({ ...current, type: e.target.value as CounterpartyType }))}
                            options={counterpartyTypeOptions}
                          />
                        ) : (
                          <span className="text-[var(--text-secondary)]">{COUNTERPARTY_TYPE_LABELS[counterparty.type]}</span>
                        )}
                      </td>
                      <td className="min-w-[180px] px-4 py-3 align-top">
                        {isEditing ? (
                          <div className="space-y-2">
                            <Input
                              value={editForm.phone}
                              onChange={(e) => setEditForm((current) => ({ ...current, phone: e.target.value }))}
                              placeholder="Phone"
                            />
                            <Input
                              value={editForm.email}
                              onChange={(e) => setEditForm((current) => ({ ...current, email: e.target.value }))}
                              placeholder="Email"
                            />
                            <Input
                              value={editForm.address}
                              onChange={(e) => setEditForm((current) => ({ ...current, address: e.target.value }))}
                              placeholder="Address"
                            />
                          </div>
                        ) : (
                          <span className="text-[var(--text-tertiary)]">
                            {[counterparty.phone, counterparty.email].filter(Boolean).join(' | ') || '-'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleUpdate(counterparty.id)}
                              disabled={editSaving}
                              className="text-emerald-400 hover:text-emerald-300"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} disabled={editSaving}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => startEdit(counterparty)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onDelete(counterparty)}
                              className="text-red-400 hover:text-red-300"
                            >
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
      </Card>
    </div>
  )
}

type DeleteTarget =
  | { kind: 'member'; item: Member }
  | { kind: 'counterparty'; item: Counterparty }
  | null

export default function MembersPage() {
  const { districtId } = useAuth()
  const toast = useToast()
  const { data: members, loading: membersLoading, add: addMember, update: updateMember, remove: removeMember } = useMembers({ district_id: districtId })
  const {
    data: counterparties,
    loading: counterpartiesLoading,
    add: addCounterparty,
    update: updateCounterparty,
    remove: removeCounterparty,
  } = useCounterparties({ district_id: districtId })

  const [activeTab, setActiveTab] = useState<DirectoryTab>('regions')
  const [confirmDelete, setConfirmDelete] = useState<DeleteTarget>(null)
  const [deleting, setDeleting] = useState(false)

  if (!districtId) {
    return (
      <div className="p-6">
        <SelectDistrictHint description="Select a district to manage its members and counterparties." />
      </div>
    )
  }

  const regions = members.filter((member) => member.type === 'region')
  const assemblies = members.filter((member) => member.type === 'assembly')
  const regionOptions = regions.map((member) => ({ value: member.id, label: member.name }))
  const assemblyOptions = assemblies.map((member) => ({ value: member.id, label: member.name }))

  const handleAddMember = async (type: MemberType, values: MemberFormState) => {
    try {
      await addMember({
        district_id: districtId,
        type,
        name: values.name,
        title: values.title,
        phone: values.phone || null,
        email: values.email || null,
        address: values.address || null,
        parent_id: values.parent_id || null,
      })
      toast.success('Saved')
    } catch (error) {
      toast.error(String(error))
      throw error
    }
  }

  const handleUpdateMember = async (id: string, values: MemberFormState) => {
    try {
      await updateMember(id, {
        name: values.name,
        title: values.title,
        phone: values.phone || null,
        email: values.email || null,
        address: values.address || null,
        parent_id: values.parent_id || null,
      })
      toast.success('Updated')
    } catch (error) {
      toast.error(String(error))
      throw error
    }
  }

  const handleAddCounterparty = async (values: CounterpartyFormState) => {
    try {
      await addCounterparty({
        district_id: districtId,
        type: values.type,
        name: values.name,
        phone: values.phone || null,
        email: values.email || null,
        address: values.address || null,
      })
      toast.success('Saved')
    } catch (error) {
      toast.error(String(error))
      throw error
    }
  }

  const handleUpdateCounterparty = async (id: string, values: CounterpartyFormState) => {
    try {
      await updateCounterparty(id, {
        type: values.type,
        name: values.name,
        phone: values.phone || null,
        email: values.email || null,
        address: values.address || null,
      })
      toast.success('Updated')
    } catch (error) {
      toast.error(String(error))
      throw error
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return

    setDeleting(true)
    try {
      if (confirmDelete.kind === 'member') {
        await removeMember(confirmDelete.item.id)
      } else {
        await removeCounterparty(confirmDelete.item.id)
      }
      setConfirmDelete(null)
      toast.success('Deleted')
    } catch (error) {
      toast.error(String(error))
    } finally {
      setDeleting(false)
    }
  }

  const currentTab = TABS.find((tab) => tab.key === activeTab)!
  const deleteTitle = confirmDelete?.kind === 'counterparty'
    ? 'Delete Counterparty'
    : `Delete ${currentTab.label.slice(0, -1)}`

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Members & Counterparties"
        description="Internal member hierarchy and external payees within this district."
        size="md"
      />

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DirectoryTab)}>
        <TabsList className="w-full justify-start">
          {TABS.map(({ key, label, icon: Icon }) => (
            <TabsTrigger key={key} value={key} className="gap-2 px-1 sm:px-4">
              <Icon className="h-4 w-4" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="regions">
          <MemberTable
            memberType="region"
            members={members}
            loading={membersLoading}
            parentOptions={[]}
            showParentColumn={false}
            showTitle={false}
            parentLabel="Parent"
            onAdd={(values) => handleAddMember('region', values)}
            onUpdate={handleUpdateMember}
            onDelete={(member) => setConfirmDelete({ kind: 'member', item: member })}
          />
        </TabsContent>

        <TabsContent value="assemblies">
          <MemberTable
            memberType="assembly"
            members={members}
            loading={membersLoading}
            parentOptions={regionOptions}
            showParentColumn={regionOptions.length > 0}
            showTitle={false}
            parentLabel="Region"
            onAdd={(values) => handleAddMember('assembly', values)}
            onUpdate={handleUpdateMember}
            onDelete={(member) => setConfirmDelete({ kind: 'member', item: member })}
          />
        </TabsContent>

        <TabsContent value="individuals">
          <MemberTable
            memberType="individual"
            members={members}
            loading={membersLoading}
            parentOptions={assemblyOptions}
            showParentColumn={assemblyOptions.length > 0}
            showTitle
            parentLabel="Assembly"
            onAdd={(values) => handleAddMember('individual', values)}
            onUpdate={handleUpdateMember}
            onDelete={(member) => setConfirmDelete({ kind: 'member', item: member })}
          />
        </TabsContent>

        <TabsContent value="counterparties">
          <CounterpartyTable
            counterparties={counterparties}
            loading={counterpartiesLoading}
            onAdd={handleAddCounterparty}
            onUpdate={handleUpdateCounterparty}
            onDelete={(counterparty) => setConfirmDelete({ kind: 'counterparty', item: counterparty })}
          />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title={deleteTitle}
        message={`Delete "${confirmDelete?.item.name ?? ''}"?`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  )
}
