'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { useMealMenu } from '@/hooks/useMealMenu'
import { Meal, MealMenuItem } from '@/types'

interface MealModalProps {
  open: boolean
  onClose: () => void
  onSave: (values: Partial<Meal>) => Promise<void>
  initial?: Meal | null
  dayId: string
}

export function MealModal({ open, onClose, onSave, initial, dayId }: MealModalProps) {
  const [form, setForm] = useState({ name: '', scheduled_time: '12:00', duration: '45' })
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  // Menu items are only managed on an existing meal
  const menu = useMealMenu(initial?.id ?? null)

  useEffect(() => {
    setForm({
      name: initial?.name ?? '',
      scheduled_time: initial?.scheduled_time?.slice(0, 5) ?? '12:00',
      duration: String(initial?.duration ?? 45),
    })
  }, [initial, open])

  const handleSubmit = async () => {
    if (!form.name.trim()) return
    setLoading(true)
    try {
      await onSave({
        day_id: dayId,
        name: form.name.trim(),
        scheduled_time: form.scheduled_time,
        duration: parseInt(form.duration) || 45,
      })
      onClose()
    } catch (e) {
      toast.error(String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit Meal' : 'Add Meal'}
      size={initial ? 'md' : 'sm'}
    >
      <div className="space-y-4">
        {/* ── Meal details ── */}
        <Input
          label="Meal Name *"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="e.g. Lunch"
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Scheduled Time"
            type="time"
            value={form.scheduled_time}
            onChange={(e) => setForm((f) => ({ ...f, scheduled_time: e.target.value }))}
          />
          <Input
            label="Duration (minutes)"
            type="number"
            min="1"
            value={form.duration}
            onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
          />
        </div>

        {/* ── Menu items (edit-only) ── */}
        {initial && (
          <>
            <div className="border-t border-slate-700 pt-4">
              <p className="text-sm font-medium text-slate-300 mb-3">Menu</p>
              <MenuItemsSection
                items={menu.data}
                loading={menu.loading}
                onAdd={menu.add}
                onUpdate={menu.update}
                onRemove={menu.remove}
                toast={toast}
              />
            </div>
          </>
        )}

        {!initial && (
          <p className="text-xs text-slate-500">Save the meal first, then reopen it to add menu items.</p>
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} className="flex-1" disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} loading={loading} className="flex-1">
            {initial ? 'Save Changes' : 'Add Meal'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────
// Menu items inline section
// ─────────────────────────────────────────────────────────────
function MenuItemsSection({
  items,
  loading,
  onAdd,
  onUpdate,
  onRemove,
  toast,
}: {
  items: MealMenuItem[]
  loading: boolean
  onAdd: (name: string, notes: string | null) => Promise<void>
  onUpdate: (id: string, name: string, notes: string | null) => Promise<void>
  onRemove: (id: string) => Promise<void>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toast: any
}) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<MealMenuItem | null>(null)

  const openAdd = () => {
    setEditingId(null)
    setForm({ name: '', notes: '' })
    setShowForm(true)
  }

  const openEdit = (item: MealMenuItem) => {
    setEditingId(item.id)
    setForm({ name: item.name, notes: item.notes ?? '' })
    setShowForm(true)
  }

  const cancel = () => { setShowForm(false); setEditingId(null) }

  const save = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (editingId) {
        await onUpdate(editingId, form.name.trim(), form.notes.trim() || null)
        toast.success('Item updated')
      } else {
        await onAdd(form.name.trim(), form.notes.trim() || null)
        toast.success('Item added')
      }
      cancel()
    } catch (e) { toast.error(String(e)) }
    finally { setSaving(false) }
  }

  if (loading) return <p className="text-xs text-slate-500">Loading…</p>

  return (
    <div className="space-y-1.5">
      {items.length === 0 && !showForm && (
        <p className="text-xs text-slate-500 py-2">No items yet.</p>
      )}

      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-2 px-3 py-2 rounded-md bg-slate-800 group"
        >
          <GripVertical className="h-3.5 w-3.5 text-slate-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm text-slate-200">{item.name}</span>
            {item.notes && (
              <span className="ml-2 text-xs text-slate-500">{item.notes}</span>
            )}
          </div>
          <div className="hidden group-hover:flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleting(item)}
              className="text-red-400 hover:text-red-300"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ))}

      {showForm && (
        <div className="flex gap-2 items-end pt-1">
          <div className="flex-1 space-y-2">
            <Input
              placeholder="Dish name *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Input
              placeholder="Notes (optional) — e.g. Vegetarian"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div className="flex gap-1 pb-0.5">
            <Button variant="ghost" size="sm" onClick={cancel} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={save} loading={saving}>
              {editingId ? 'Save' : 'Add'}
            </Button>
          </div>
        </div>
      )}

      {!showForm && (
        <button
          type="button"
          onClick={openAdd}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 transition mt-1 px-1"
        >
          <Plus className="h-3 w-3" /> Add item
        </button>
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return
          try { await onRemove(deleting.id); toast.success('Item removed') }
          catch (e) { toast.error(String(e)) }
          setDeleting(null)
        }}
        title="Remove Menu Item"
        message={`Remove "${deleting?.name}" from the menu?`}
      />
    </div>
  )
}
