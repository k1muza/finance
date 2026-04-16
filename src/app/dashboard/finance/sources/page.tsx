'use client'

import { useState } from 'react'
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  ChevronRight,
  ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { useSources } from '@/hooks/useSources'
import { SelectDistrictHint } from '@/components/layout/SelectDistrictHint'
import { Source, SourceType, SOURCE_TYPE_LABELS } from '@/types'

interface SourceFormState {
  parent_id: string
  type: SourceType
  name: string
  code: string
  phone: string
  email: string
  address: string
  notes: string
}

const emptyForm = (): SourceFormState => ({
  parent_id: '',
  type: 'individual',
  name: '',
  code: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
})

function typeVariant(type: SourceType): 'default' | 'teal' | 'green' | 'yellow' {
  switch (type) {
    case 'assembly': return 'teal'
    case 'region': return 'green'
    case 'individual': return 'default'
    case 'supplier': return 'yellow'
    default: return 'default'
  }
}

function SourceRow({
  source,
  depth,
  allSources,
  onEdit,
  onDelete,
}: {
  source: Source
  depth: number
  allSources: Source[]
  onEdit: (s: Source) => void
  onDelete: (s: Source) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const children = allSources.filter((s) => s.parent_id === source.id)

  return (
    <>
      <tr className="border-b border-slate-700/50 last:border-0">
        <td className="px-4 py-3 align-top">
          <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 20}px` }}>
            {children.length > 0 ? (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="text-slate-500 hover:text-slate-300 shrink-0"
              >
                {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            ) : (
              <span className="w-3.5 shrink-0" />
            )}
            <span className="text-slate-100 font-medium">{source.name}</span>
            {!source.is_active && <span className="text-xs text-slate-600 italic ml-1">Inactive</span>}
          </div>
          {source.code && <p className="text-xs text-slate-500 font-mono pl-5" style={{ paddingLeft: `${depth * 20 + 20}px` }}>{source.code}</p>}
        </td>
        <td className="px-4 py-3 align-top">
          <Badge variant={typeVariant(source.type)}>{SOURCE_TYPE_LABELS[source.type]}</Badge>
        </td>
        <td className="px-4 py-3 align-top text-slate-400 text-sm">
          {[source.phone, source.email].filter(Boolean).join(' · ') || '—'}
        </td>
        <td className="px-4 py-3 align-top">
          <div className="flex items-center justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={() => onEdit(source)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onDelete(source)} className="text-red-400 hover:text-red-300">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </td>
      </tr>
      {expanded && children.map((child) => (
        <SourceRow
          key={child.id}
          source={child}
          depth={depth + 1}
          allSources={allSources}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </>
  )
}

export default function SourcesPage() {
  const { districtId } = useAuth()
  const toast = useToast()
  const { data: sources, loading, add, update, remove } = useSources({ district_id: districtId })

  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newSource, setNewSource] = useState<SourceFormState>(emptyForm())

  const [editingSource, setEditingSource] = useState<Source | null>(null)
  const [editForm, setEditForm] = useState<SourceFormState>(emptyForm())
  const [editSaving, setEditSaving] = useState(false)

  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; source: Source | null }>({ open: false, source: null })
  const [deleting, setDeleting] = useState(false)

  if (!districtId) {
    return (
      <div className="p-6">
        <SelectDistrictHint description="Select a district to manage its sources and counterparties." />
      </div>
    )
  }

  // Only top-level sources (no parent) are rendered at the root; children are rendered recursively
  const roots = sources.filter((s) => !s.parent_id)

  const parentOptions = sources.map((s) => ({ value: s.id, label: `${s.name} (${SOURCE_TYPE_LABELS[s.type]})` }))

  const handleAdd = async () => {
    if (!newSource.name.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    try {
      await add({
        district_id: districtId,
        parent_id: newSource.parent_id || null,
        type: newSource.type,
        name: newSource.name,
        code: newSource.code || null,
        phone: newSource.phone || null,
        email: newSource.email || null,
        address: newSource.address || null,
        notes: newSource.notes || null,
      })
      setNewSource(emptyForm())
      setAdding(false)
      toast.success('Source added')
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (s: Source) => {
    setEditingSource(s)
    setEditForm({
      parent_id: s.parent_id ?? '',
      type: s.type,
      name: s.name,
      code: s.code ?? '',
      phone: s.phone ?? '',
      email: s.email ?? '',
      address: s.address ?? '',
      notes: s.notes ?? '',
    })
  }

  const saveEdit = async () => {
    if (!editingSource || !editForm.name.trim()) { toast.error('Name is required'); return }
    setEditSaving(true)
    try {
      await update(editingSource.id, {
        parent_id: editForm.parent_id || null,
        type: editForm.type,
        name: editForm.name,
        code: editForm.code || null,
        phone: editForm.phone || null,
        email: editForm.email || null,
        address: editForm.address || null,
        notes: editForm.notes || null,
      })
      setEditingSource(null)
      toast.success('Source updated')
    } catch (e) {
      toast.error(String(e))
    } finally {
      setEditSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete.source) return
    setDeleting(true)
    try {
      await remove(confirmDelete.source.id)
      setConfirmDelete({ open: false, source: null })
      toast.success('Source deleted')
    } catch (e) {
      toast.error(String(e))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
            <Users className="h-5 w-5 text-cyan-400" />
            Sources
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Counterparties, congregations, individuals, suppliers, and departments.
          </p>
        </div>
        {!adding && (
          <Button onClick={() => { setAdding(true); setNewSource(emptyForm()) }}>
            <Plus className="h-4 w-4" />
            Add source
          </Button>
        )}
      </div>

      {adding && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
          <h2 className="font-medium text-slate-200 text-sm">New source</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <Input
              label="Name *"
              value={newSource.name}
              onChange={(e) => setNewSource((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Accra Assembly"
            />
            <Select
              label="Type"
              value={newSource.type}
              onChange={(e) => setNewSource((f) => ({ ...f, type: e.target.value as SourceType }))}
              options={Object.entries(SOURCE_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
            />
            <Input
              label="Code"
              value={newSource.code}
              onChange={(e) => setNewSource((f) => ({ ...f, code: e.target.value }))}
              placeholder="Optional short code"
            />
            <Select
              label="Parent"
              value={newSource.parent_id}
              onChange={(e) => setNewSource((f) => ({ ...f, parent_id: e.target.value }))}
              placeholder="No parent"
              options={parentOptions}
            />
            <Input
              label="Phone"
              value={newSource.phone}
              onChange={(e) => setNewSource((f) => ({ ...f, phone: e.target.value }))}
              placeholder="Optional"
            />
            <Input
              label="Email"
              type="email"
              value={newSource.email}
              onChange={(e) => setNewSource((f) => ({ ...f, email: e.target.value }))}
              placeholder="Optional"
            />
            <Input
              label="Address"
              value={newSource.address}
              onChange={(e) => setNewSource((f) => ({ ...f, address: e.target.value }))}
              placeholder="Optional"
            />
            <Input
              label="Notes"
              value={newSource.notes}
              onChange={(e) => setNewSource((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Optional"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAdding(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleAdd} loading={saving}>Save source</Button>
          </div>
        </div>
      )}

      {editingSource && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
          <h2 className="font-medium text-slate-200 text-sm">Edit — {editingSource.name}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <Input
              label="Name *"
              value={editForm.name}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Select
              label="Type"
              value={editForm.type}
              onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value as SourceType }))}
              options={Object.entries(SOURCE_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
            />
            <Input
              label="Code"
              value={editForm.code}
              onChange={(e) => setEditForm((f) => ({ ...f, code: e.target.value }))}
            />
            <Select
              label="Parent"
              value={editForm.parent_id}
              onChange={(e) => setEditForm((f) => ({ ...f, parent_id: e.target.value }))}
              placeholder="No parent"
              options={parentOptions.filter((o) => o.value !== editingSource.id)}
            />
            <Input
              label="Phone"
              value={editForm.phone}
              onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
            />
            <Input
              label="Email"
              type="email"
              value={editForm.email}
              onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
            />
            <Input
              label="Address"
              value={editForm.address}
              onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
            />
            <Input
              label="Notes"
              value={editForm.notes}
              onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditingSource(null)} disabled={editSaving}>Cancel</Button>
            <Button onClick={saveEdit} loading={editSaving}>Save changes</Button>
          </div>
        </div>
      )}

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="px-5 py-8 text-sm text-slate-500">Loading sources...</div>
        ) : sources.length === 0 ? (
          <div className="px-5 py-8 text-sm text-slate-500">
            No sources yet. Add assemblies, individuals, suppliers, or other counterparties.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Name</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Type</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Contact</th>
                  <th className="w-24 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {roots.map((source) => (
                  <SourceRow
                    key={source.id}
                    source={source}
                    depth={0}
                    allSources={sources}
                    onEdit={startEdit}
                    onDelete={(s) => setConfirmDelete({ open: true, source: s })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false, source: null })}
        onConfirm={handleDelete}
        title="Delete Source"
        message={`Delete "${confirmDelete.source?.name ?? ''}"? Child sources will be unlinked from this parent.`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  )
}
