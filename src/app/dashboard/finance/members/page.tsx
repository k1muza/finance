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

// ─── types ────────────────────────────────────────────────────────────────────

type MemberTab = 'individuals' | 'assemblies' | 'regions'

const TABS: { key: MemberTab; label: string; icon: React.ElementType; sourceType: SourceType }[] = [
  { key: 'regions',     label: 'Regions',     icon: MapPin,  sourceType: 'region'     },
  { key: 'assemblies',  label: 'Assemblies',  icon: Church,  sourceType: 'assembly'   },
  { key: 'individuals', label: 'Individuals', icon: User,    sourceType: 'individual' },
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

// ─── per-tab table ────────────────────────────────────────────────────────────

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

  const typeItems = sources.filter((s) => s.type === sourceType)

  const handleAdd = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    try {
      await onAdd(form)
      setForm(emptyForm())
      setAdding(false)
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (s: Source) => {
    setEditingId(s.id)
    setEditForm({
      name: s.name,
      code: s.code ?? '',
      title: s.title ?? 'saint',
      phone: s.phone ?? '',
      email: s.email ?? '',
      address: s.address ?? '',
      parent_id: s.parent_id ?? '',
    })
  }

  const handleUpdate = async (id: string) => {
    if (!editForm.name.trim()) { toast.error('Name is required'); return }
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
    assembly:   { namePlaceholder: 'e.g. Accra Central Assembly', emptyText: 'No assemblies yet.' },
    region:     { namePlaceholder: 'e.g. Greater Accra Region', emptyText: 'No regions yet.' },
    district:   { namePlaceholder: '', emptyText: '' },
    supplier:   { namePlaceholder: '', emptyText: '' },
    department: { namePlaceholder: '', emptyText: '' },
    other:      { namePlaceholder: '', emptyText: '' },
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
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value as IndividualTitle }))}
                options={titleOptions}
              />
            )}
            <Input
              label="Name *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={labels[sourceType].namePlaceholder}
            />
            {parentOptions.length > 0 && (
              <Select
                label={parentLabel}
                value={form.parent_id}
                onChange={(e) => setForm((f) => ({ ...f, parent_id: e.target.value }))}
                placeholder={`No ${parentLabel.toLowerCase()}`}
                options={parentOptions}
              />
            )}
            <Input
              label="Phone"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="Optional"
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="Optional"
            />
            <Input
              label="Address"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Optional"
            />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAdding(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleAdd} loading={saving}>Save</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader className="flex items-center justify-between border-b border-slate-700 px-5 py-3">
          <span className="text-xs text-slate-500">{typeItems.length} {typeItems.length === 1 ? 'record' : 'records'}</span>
          {!adding && (
            <Button variant="ghost" size="sm" onClick={() => { setAdding(true); setForm(emptyForm()) }}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          )}
        </CardHeader>

        {loading ? (
          <div className="px-5 py-8 text-sm text-slate-500">Loading...</div>
        ) : typeItems.length === 0 ? (
          <div className="px-5 py-8 text-sm text-slate-500">{labels[sourceType].emptyText}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Name</th>
                  {showParentColumn && (
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">{parentLabel}</th>
                  )}
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Contact</th>
                  <th className="w-20 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {typeItems.map((s) => {
                  const isEditing = editingId === s.id
                  const parentName = parentOptions.find((o) => o.value === s.parent_id)?.label ?? null

                  return (
                    <tr key={s.id} className={`border-b border-slate-700/50 last:border-0 ${isEditing ? 'bg-slate-900/40' : ''}`}>
                      <td className="px-4 py-3 align-top min-w-[200px]">
                        {isEditing ? (
                          <div className="space-y-2">
                            {showTitle && (
                              <Select
                                value={editForm.title}
                                onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value as IndividualTitle }))}
                                options={titleOptions}
                              />
                            )}
                            <Input
                              value={editForm.name}
                              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                              placeholder="Name"
                            />
                          </div>
                        ) : (
                          <div>
                            <p className="text-slate-100 font-medium">
                              {showTitle && s.title && s.title !== 'saint' && (
                                <span className="text-cyan-400 font-semibold mr-1">{INDIVIDUAL_TITLE_LABELS[s.title]}</span>
                              )}
                              {s.name}
                            </p>
                            {!s.is_active && <span className="text-xs text-slate-600 italic">Inactive</span>}
                          </div>
                        )}
                      </td>
                      {showParentColumn && (
                        <td className="px-4 py-3 align-top min-w-[180px]">
                          {isEditing ? (
                            <Select
                              value={editForm.parent_id}
                              onChange={(e) => setEditForm((f) => ({ ...f, parent_id: e.target.value }))}
                              placeholder={`No ${parentLabel.toLowerCase()}`}
                              options={parentOptions.filter((o) => o.value !== s.id)}
                            />
                          ) : (
                            <span className={parentName ? 'text-slate-300' : 'text-slate-600'}>
                              {parentName ?? '—'}
                            </span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 align-top min-w-[180px]">
                        {isEditing ? (
                          <div className="space-y-2">
                            <Input
                              value={editForm.phone}
                              onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                              placeholder="Phone"
                            />
                            <Input
                              value={editForm.email}
                              onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                              placeholder="Email"
                            />
                            <Input
                              value={editForm.address}
                              onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
                              placeholder="Address"
                            />
                          </div>
                        ) : (
                          <span className="text-slate-400">
                            {[s.phone, s.email].filter(Boolean).join(' · ') || '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => handleUpdate(s.id)} disabled={editSaving} className="text-emerald-400 hover:text-emerald-300">
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} disabled={editSaving}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => startEdit(s)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => onDelete(s)} className="text-red-400 hover:text-red-300">
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

// ─── page ─────────────────────────────────────────────────────────────────────

export default function MembersPage() {
  const { districtId } = useAuth()
  const toast = useToast()
  const { data: sources, loading, add, update, remove } = useSources({ district_id: districtId })

  const [activeTab, setActiveTab] = useState<MemberTab>('regions')
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; source: Source | null }>({ open: false, source: null })
  const [deleting, setDeleting] = useState(false)

  if (!districtId) {
    return (
      <div className="p-6">
        <SelectDistrictHint description="Select a district to manage its members." />
      </div>
    )
  }

  const regions    = sources.filter((s) => s.type === 'region')
  const assemblies = sources.filter((s) => s.type === 'assembly')

  const regionOptions   = regions.map((s) => ({ value: s.id, label: s.name }))
  const assemblyOptions = assemblies.map((s) => ({ value: s.id, label: s.name }))

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
    } catch (e) {
      toast.error(String(e))
      throw e
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
    } catch (e) {
      toast.error(String(e))
      throw e
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete.source) return
    setDeleting(true)
    try {
      await remove(confirmDelete.source.id)
      setConfirmDelete({ open: false, source: null })
      toast.success('Deleted')
    } catch (e) {
      toast.error(String(e))
    } finally {
      setDeleting(false)
    }
  }

  const currentTab = TABS.find((t) => t.key === activeTab)!

  return (
    <div className="p-6 space-y-6">
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
            onDelete={(s) => setConfirmDelete({ open: true, source: s })}
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
            onDelete={(s) => setConfirmDelete({ open: true, source: s })}
          />
        </TabsContent>

        <TabsContent value="individuals">
          <MemberTable
            sourceType="individual"
            sources={sources}
            loading={loading}
            parentOptions={assemblyOptions}
            showParentColumn={assemblyOptions.length > 0}
            showTitle={true}
            parentLabel="Assembly"
            onAdd={(values) => handleAdd('individual', values)}
            onUpdate={handleUpdate}
            onDelete={(s) => setConfirmDelete({ open: true, source: s })}
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
