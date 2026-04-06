'use client'

import { useState } from 'react'
import { useCategories } from '@/hooks/useCategories'
import { useToast } from '@/components/ui/Toast'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { PageSpinner } from '@/components/ui/Spinner'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'

type CategoryTable = 'expense_categories' | 'income_categories'

interface CategoryManagerModalProps {
  open: boolean
  onClose: () => void
  table: CategoryTable
  title: string
  description: string
}

export function CategoryManagerModal({
  open,
  onClose,
  table,
  title,
  description,
}: CategoryManagerModalProps) {
  const { data, loading, add, update, remove } = useCategories(table)
  const toast = useToast()

  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string; name: string }>({
    open: false, id: '', name: '',
  })
  const [deleting, setDeleting] = useState(false)

  const handleAdd = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      await add(newName)
      setNewName('')
      setAdding(false)
      toast.success('Category added')
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) {
      toast.error('Name is required')
      return
    }
    setEditSaving(true)
    try {
      await update(id, editName)
      setEditingId(null)
      toast.success('Saved')
    } catch (e) {
      toast.error(String(e))
    } finally {
      setEditSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await remove(confirmDelete.id)
      setConfirmDelete({ open: false, id: '', name: '' })
      toast.success('Category deleted')
    } catch (e) {
      toast.error(String(e))
    } finally {
      setDeleting(false)
    }
  }

  const close = () => {
    setAdding(false)
    setEditingId(null)
    setConfirmDelete({ open: false, id: '', name: '' })
    onClose()
  }

  const inputCls = 'w-full rounded-md bg-slate-900 border border-slate-600 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500'

  return (
    <>
      <Modal open={open} onClose={close} title={title} size="md">
        <div className="space-y-4">
          <p className="text-sm text-slate-400">{description}</p>

          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <h3 className="text-sm font-semibold text-slate-200">Categories</h3>
              {!adding && (
                <Button size="sm" variant="ghost" onClick={() => { setNewName(''); setAdding(true) }}>
                  <Plus className="h-4 w-4" /> Add
                </Button>
              )}
            </div>

            {loading ? (
              <div className="p-6"><PageSpinner /></div>
            ) : (
              <ul className="divide-y divide-slate-700/50">
                {adding && (
                  <li className="flex items-center gap-2 px-5 py-3 bg-slate-700/30">
                    <input
                      className={inputCls}
                      placeholder="Category name..."
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAdd()
                        if (e.key === 'Escape') setAdding(false)
                      }}
                      autoFocus
                    />
                    <Button size="sm" variant="ghost" onClick={handleAdd} disabled={saving || !newName.trim()} className="text-emerald-400 hover:text-emerald-300 shrink-0">
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setAdding(false)} disabled={saving} className="shrink-0">
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                )}

                {data.length === 0 && !adding && (
                  <li className="px-5 py-6 text-center text-sm text-slate-500">No categories yet.</li>
                )}

                {data.map((cat) => (
                  <li key={cat.id} className="flex items-center gap-2 px-5 py-3 hover:bg-slate-700/20 transition group">
                    {editingId === cat.id ? (
                      <>
                        <input
                          className={inputCls}
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdate(cat.id)
                            if (e.key === 'Escape') setEditingId(null)
                          }}
                          autoFocus
                        />
                        <Button size="sm" variant="ghost" onClick={() => handleUpdate(cat.id)} disabled={editSaving} className="text-emerald-400 hover:text-emerald-300 shrink-0">
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} disabled={editSaving} className="shrink-0">
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm text-slate-200">{cat.name}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          <Button size="sm" variant="ghost" onClick={() => { setEditingId(cat.id); setEditName(cat.name) }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmDelete({ open: true, id: cat.id, name: cat.name })} className="text-red-400 hover:text-red-300">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false, id: '', name: '' })}
        onConfirm={handleDelete}
        title="Delete Category"
        message={`Delete "${confirmDelete.name}"? Existing entries with this category won't be affected.`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </>
  )
}
