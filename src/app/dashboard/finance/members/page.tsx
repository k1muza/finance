'use client'

import { useState } from 'react'
import {
  User,
  Church,
  MapPin,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
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
import { useSources } from '@/hooks/useSources'
import { SelectDistrictHint } from '@/components/layout/SelectDistrictHint'
import { Source, SourceType, IndividualTitle, INDIVIDUAL_TITLE_LABELS } from '@/types'

type MemberTab = 'individuals' | 'assemblies' | 'regions'

const TABS: { key: MemberTab; label: string; icon: React.ElementType; sourceType: SourceType }[] = [
  { key: 'regions', label: 'Regions', icon: MapPin, sourceType: 'region' },
  { key: 'assemblies', label: 'Assemblies', icon: Church, sourceType: 'assembly' },
  { key: 'individuals', label: 'Individuals', icon: User, sourceType: 'individual' },
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

const emptyForm = (): MemberFormState => ({
  name: '',
  code: '',
  title: 'saint',
  phone: '',
  email: '',
  address: '',
  parent_id: '',
})

function MemberTable({
  sourceType,
  sources,
  loading,
  parentOptions,
  showParentColumn,
  showTitle,
  parentLabel,
  onAdd,
  onUpdate,
  onDelete,
}: {
  sourceType: SourceType
  sources: Source[]
  loading: boolean
  parentOptions: { value: string; label: string }[]
  showParentColumn: boolean
  showTitle: boolean
  parentLabel: string
  onAdd: (values: MemberFormState) => Promise<void>
  onUpdate: (id: string, values: MemberFormState) => Promise<void>
  onDelete: (source: Source) => void
}) {
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<MemberFormState>(emptyForm())

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<MemberFormState>(emptyForm())
  const [editSaving, setEditSaving] = useState(false)

  const toast = useToast()

  const typeItems = sources.filter((source) => source.type === sourceType)

  const handleAdd = async () => {
    if (!form.name.trim()) {
      toast.error('Name is required')
      return
    }

    setSaving(true)
    try {
      await onAdd(form)
      setForm(emptyForm())
      setAdding(false)
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (source: Source) => {
    setEditingId(source.id)
    setEditForm({
      name: source.name,
      code: source.code ?? '',
      title: source.title ?? 'saint',
      phone: source.phone ?? '',
      email: source.email ?? '',
      address: source.address ?? '',
      parent_id: source.parent_id ?? '',
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

  const labels: Record<SourceType, { namePlaceholder: string; emptyText: string }> = {
    individual: { namePlaceholder: 'e.g. John Mensah', emptyText: 'No individuals yet.' },
    assembly: { namePlaceholder: 'e.g. Accra Central Assembly', emptyText: 'No assemblies yet.' },
    region: { namePlaceholder: 'e.g. Greater Accra Region', emptyText: 'No regions yet.' },
    district: { namePlaceholder: '', emptyText: '' },
    supplier: { namePlaceholder: '', emptyText: '' },
    department: { namePlaceholder: '', emptyText: '' },
    other: { namePlaceholder: '', emptyText: '' },
  }

  const titleOptions = (Object.entries(INDIVIDUAL_TITLE_LABELS) as [IndividualTitle, string][])
    .map(([value, label]) => ({ value, label }))

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
                placeholder={labels[sourceType].namePlaceholder}
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
            <Button variant="ghost" size="sm" onClick={() => { setAdding(true); setForm(emptyForm()) }}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          )}
        </CardHeader>

        {loading ? (
          <div className="px-5 py-8 text-sm text-[var(--text-muted)]">Loading...</div>
        ) : typeItems.length === 0 ? (
          <div className="px-5 py-8 text-sm text-[var(--text-muted)]">{labels[sourceType].emptyText}</div>
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
                {typeItems.map((source) => {
                  const isEditing = editingId === source.id
                  const parentName = parentOptions.find((option) => option.value === source.parent_id)?.label ?? null

                  return (
                    <tr
                      key={source.id}
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
                              {showTitle && source.title && source.title !== 'saint' && (
                                <span className="mr-1 font-semibold text-[var(--theme-accent-400)]">
                                  {INDIVIDUAL_TITLE_LABELS[source.title]}
                                </span>
                              )}
                              {source.name}
                            </p>
                            {!source.is_active && (
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
                              options={parentOptions.filter((option) => option.value !== source.id)}
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
                            {[source.phone, source.email].filter(Boolean).join(' | ') || '-'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleUpdate(source.id)}
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
                            <Button size="sm" variant="ghost" onClick={() => startEdit(source)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onDelete(source)}
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

export default function MembersPage() {
  const { districtId } = useAuth()
  const toast = useToast()
  const { data: sources, loading, add, update, remove } = useSources({ district_id: districtId })

  const [activeTab, setActiveTab] = useState<MemberTab>('regions')
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; source: Source | null }>({
    open: false,
    source: null,
  })
  const [deleting, setDeleting] = useState(false)

  if (!districtId) {
    return (
      <div className="p-6">
        <SelectDistrictHint description="Select a district to manage its members." />
      </div>
    )
  }

  const regions = sources.filter((source) => source.type === 'region')
  const assemblies = sources.filter((source) => source.type === 'assembly')

  const regionOptions = regions.map((source) => ({ value: source.id, label: source.name }))
  const assemblyOptions = assemblies.map((source) => ({ value: source.id, label: source.name }))

  const handleAdd = async (type: SourceType, values: MemberFormState) => {
    try {
      await add({
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

  const handleUpdate = async (id: string, values: MemberFormState) => {
    try {
      await update(id, {
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

  const handleDelete = async () => {
    if (!confirmDelete.source) return

    setDeleting(true)
    try {
      await remove(confirmDelete.source.id)
      setConfirmDelete({ open: false, source: null })
      toast.success('Deleted')
    } catch (error) {
      toast.error(String(error))
    } finally {
      setDeleting(false)
    }
  }

  const currentTab = TABS.find((tab) => tab.key === activeTab)!

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Members"
        description="Individuals, assemblies, and regions within this district."
        size="md"
      />

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as MemberTab)}>
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
            sourceType="region"
            sources={sources}
            loading={loading}
            parentOptions={[]}
            showParentColumn={false}
            showTitle={false}
            parentLabel="Parent"
            onAdd={(values) => handleAdd('region', values)}
            onUpdate={handleUpdate}
            onDelete={(source) => setConfirmDelete({ open: true, source })}
          />
        </TabsContent>

        <TabsContent value="assemblies">
          <MemberTable
            sourceType="assembly"
            sources={sources}
            loading={loading}
            parentOptions={regionOptions}
            showParentColumn={regionOptions.length > 0}
            showTitle={false}
            parentLabel="Region"
            onAdd={(values) => handleAdd('assembly', values)}
            onUpdate={handleUpdate}
            onDelete={(source) => setConfirmDelete({ open: true, source })}
          />
        </TabsContent>

        <TabsContent value="individuals">
          <MemberTable
            sourceType="individual"
            sources={sources}
            loading={loading}
            parentOptions={assemblyOptions}
            showParentColumn={assemblyOptions.length > 0}
            showTitle
            parentLabel="Assembly"
            onAdd={(values) => handleAdd('individual', values)}
            onUpdate={handleUpdate}
            onDelete={(source) => setConfirmDelete({ open: true, source })}
          />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false, source: null })}
        onConfirm={handleDelete}
        title={`Delete ${currentTab.label.slice(0, -1)}`}
        message={`Delete "${confirmDelete.source?.name ?? ''}"?`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  )
}
