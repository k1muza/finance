'use client'

import { useState } from 'react'
import { Day } from '@/types'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { cn } from '@/lib/utils/cn'
import { format, parseISO } from 'date-fns'
import { Plus, Pencil } from 'lucide-react'

interface DayTabsProps {
  days: Day[]
  selectedId: string | null
  onSelect: (id: string) => void
  onCreate: (values: { date: string; label: string | null }) => Promise<void>
  onUpdate: (id: string, values: { label: string | null }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function DayTabs({ days, selectedId, onSelect, onCreate, onUpdate, onDelete }: DayTabsProps) {
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Day | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Day | null>(null)
  const [date, setDate] = useState('')
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)

  const handleCreate = async () => {
    if (!date) return
    setSaving(true)
    try {
      await onCreate({ date, label: label.trim() || null })
      setAddOpen(false)
      setDate('')
      setLabel('')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!editTarget) return
    setSaving(true)
    try {
      await onUpdate(editTarget.id, { label: label.trim() || null })
      setEditTarget(null)
      setLabel('')
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (e: React.MouseEvent, day: Day) => {
    e.stopPropagation()
    setEditTarget(day)
    setLabel(day.label ?? '')
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {days.map((day) => (
        <div key={day.id} className="relative group">
          <button
            onClick={() => onSelect(day.id)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              selectedId === day.id
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 bg-slate-800 hover:text-slate-100 hover:bg-slate-700'
            )}
          >
            {day.label ?? format(parseISO(day.date), 'MMM d')}
          </button>
          <div className="absolute -top-1 -right-1 hidden group-hover:flex items-center gap-0.5">
            <button
              onClick={(e) => openEdit(e, day)}
              className="bg-slate-600 text-white rounded-full w-4 h-4 flex items-center justify-center"
            >
              <Pencil className="w-2.5 h-2.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setDeleteTarget(day) }}
              className="bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs"
            >
              ×
            </button>
          </div>
        </div>
      ))}

      <Button variant="ghost" size="sm" onClick={() => setAddOpen(true)}>
        <Plus className="h-4 w-4" /> Add Day
      </Button>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Conference Day" size="sm">
        <div className="space-y-4">
          <Input label="Date *" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label="Label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Thursday" />
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" onClick={() => setAddOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleCreate} loading={saving} className="flex-1">Add Day</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!editTarget} onClose={() => { setEditTarget(null); setLabel('') }} title="Edit Day Label" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-400">{editTarget?.date}</p>
          <Input label="Label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Thursday" autoFocus />
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" onClick={() => { setEditTarget(null); setLabel('') }} className="flex-1">Cancel</Button>
            <Button onClick={handleUpdate} loading={saving} className="flex-1">Save</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => { if (deleteTarget) { await onDelete(deleteTarget.id); setDeleteTarget(null) } }}
        title="Delete Day"
        message={`Delete ${deleteTarget?.label ?? deleteTarget?.date}? All sessions, events, and meals for this day will be removed.`}
      />
    </div>
  )
}
