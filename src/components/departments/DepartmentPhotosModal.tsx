'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Department, DepartmentPhoto } from '@/types'
import { useDepartmentPhotos } from '@/hooks/useDepartmentPhotos'
import { useToast } from '@/components/ui/Toast'
import { Trash2, Plus, ImageIcon } from 'lucide-react'

interface DepartmentPhotosModalProps {
  open: boolean
  onClose: () => void
  department: Department | null
  districtId: string | null
}

function AddPhotoForm({ onAdd }: { onAdd: (values: { url: string; caption: string | null; taken_at: string | null }) => Promise<void> }) {
  const [url, setUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [takenAt, setTakenAt] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAdd = async () => {
    if (!url.trim()) return
    setLoading(true)
    try {
      await onAdd({ url: url.trim(), caption: caption.trim() || null, taken_at: takenAt || null })
      setUrl('')
      setCaption('')
      setTakenAt('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3 border border-slate-700 rounded-lg p-4 bg-slate-800/50">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Add Photo</p>
      <Input
        label="Photo URL *"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://…"
      />
      <Input
        label="Caption"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Optional caption"
      />
      <Input
        label="Date Taken"
        type="date"
        value={takenAt}
        onChange={(e) => setTakenAt(e.target.value)}
      />
      <Button onClick={handleAdd} loading={loading} disabled={!url.trim()} size="sm">
        <Plus className="h-3.5 w-3.5" /> Add Photo
      </Button>
    </div>
  )
}

function PhotoRow({ photo, onRemove }: { photo: DepartmentPhoto; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-slate-800 group">
      <img src={photo.url} alt={photo.caption ?? ''} className="h-12 w-16 object-cover rounded shrink-0 bg-slate-700" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-200 truncate">{photo.caption ?? <span className="text-slate-500 italic">No caption</span>}</p>
        {photo.taken_at && (
          <p className="text-xs text-slate-500">{new Date(photo.taken_at).toLocaleDateString()}</p>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="text-red-400 hover:text-red-300 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}

export function DepartmentPhotosModal({ open, onClose, department, districtId }: DepartmentPhotosModalProps) {
  const { data: photos, loading, add, remove } = useDepartmentPhotos(
    department?.id ?? null,
    districtId
  )
  const toast = useToast()

  const handleAdd = async (values: { url: string; caption: string | null; taken_at: string | null }) => {
    try {
      await add(values)
      toast.success('Photo added')
    } catch (e) {
      toast.error(String(e))
      throw e
    }
  }

  const handleRemove = async (id: string) => {
    try {
      await remove(id)
      toast.success('Photo removed')
    } catch (e) {
      toast.error(String(e))
    }
  }

  if (!department) return null

  return (
    <Modal open={open} onClose={onClose} title={`${department.name} — Photos`} size="md">
      <div className="space-y-4">
        {loading ? (
          <p className="text-sm text-slate-500 text-center py-4">Loading…</p>
        ) : photos.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-slate-500">
            <ImageIcon className="h-8 w-8" />
            <p className="text-sm">No photos yet</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {photos.map((p) => (
              <PhotoRow key={p.id} photo={p} onRemove={() => handleRemove(p.id)} />
            ))}
          </div>
        )}

        <AddPhotoForm onAdd={handleAdd} />
      </div>
    </Modal>
  )
}
