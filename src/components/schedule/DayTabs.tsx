'use client'

import { useState } from 'react'
import { Day } from '@/types'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { cn } from '@/lib/utils/cn'
import { format, parseISO } from 'date-fns'
import { Plus, Trash2 } from 'lucide-react'

interface DayTabsProps {
  days: Day[]
  selectedId: string | null
  onSelect: (id: string) => void
  onCreate: (values: { date: string; label: string | null }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function DayTabs({ days, selectedId, onSelect, onCreate, onDelete }: DayTabsProps) {
  const [addOpen, setAddOpen] = useState(false)
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
          {selectedId !== day.id && (
            <button
              onClick={(e) => { e.stopPropagation(); setDeleteTarget(day) }}
              className="absolute -top-1 -right-1 hidden group-hover:flex bg-red-600 text-white rounded-full w-4 h-4 items-center justify-center text-xs"
            >
              ×
            </button>
          )}
        </div>
      ))}

      <Button variant="ghost" size="sm" onClick={() => setAddOpen(true)}>
        <Plus className="h-4 w-4" /> Add Day
      </Button>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Conference Day" size="sm">
        <div className="space-y-4">
          <Input label="Date *" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label="Label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Day 1 — Opening" />
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" onClick={() => setAddOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleCreate} loading={saving} className="flex-1">Add Day</Button>
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
