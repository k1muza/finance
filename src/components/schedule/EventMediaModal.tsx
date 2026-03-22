'use client'

import { useState, useRef } from 'react'
import { Film, MessageSquare, Image, Plus, Pencil, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { useEventMedia } from '@/hooks/useEventMedia'
import { Event, EventVideo, EventCommentary, EventPhoto } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  event: Event
}

type Tab = 'videos' | 'commentaries' | 'photos'

export function EventMediaModal({ open, onClose, event }: Props) {
  const [tab, setTab] = useState<Tab>('videos')
  const media = useEventMedia(open ? event.id : null)
  const toast = useToast()

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { id: 'videos',        label: 'Videos',        icon: <Film          className="h-3.5 w-3.5" />, count: media.videos.length },
    { id: 'commentaries',  label: 'Commentaries',  icon: <MessageSquare className="h-3.5 w-3.5" />, count: media.commentaries.length },
    { id: 'photos',        label: 'Photos',        icon: <Image         className="h-3.5 w-3.5" />, count: media.photos.length },
  ]

  return (
    <Modal open={open} onClose={onClose} title={`Media — ${event.title}`} size="lg">
      {/* Tab bar */}
      <div className="flex gap-0.5 border-b border-slate-700 mb-5 -mt-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm transition -mb-px ${
              tab === t.id
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.icon}
            {t.label}
            {t.count > 0 && (
              <span className={`rounded-full px-1.5 text-xs leading-5 ${
                tab === t.id ? 'bg-cyan-900/50 text-cyan-300' : 'bg-slate-700 text-slate-400'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {media.loading && <p className="text-sm text-slate-400 py-4">Loading…</p>}

      {!media.loading && (
        <>
          {tab === 'videos' && (
            <VideosSection
              eventId={event.id}
              items={media.videos}
              onAdd={media.addVideo}
              onUpdate={media.updateVideo}
              onRemove={media.removeVideo}
              toast={toast}
            />
          )}
          {tab === 'commentaries' && (
            <CommentariesSection
              eventId={event.id}
              items={media.commentaries}
              onAdd={media.addCommentary}
              onUpdate={media.updateCommentary}
              onRemove={media.removeCommentary}
              toast={toast}
            />
          )}
          {tab === 'photos' && (
            <PhotosSection
              eventId={event.id}
              items={media.photos}
              onAdd={media.addPhoto}
              onUpdate={media.updatePhoto}
              onRemove={media.removePhoto}
              toast={toast}
            />
          )}
        </>
      )}
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────
// Videos
// ─────────────────────────────────────────────────────────────
function VideosSection({
  eventId, items, onAdd, onUpdate, onRemove, toast,
}: {
  eventId: string
  items: EventVideo[]
  onAdd: (v: Omit<EventVideo, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  onUpdate: (id: string, v: Partial<Omit<EventVideo, 'id' | 'created_at' | 'updated_at'>>) => Promise<void>
  onRemove: (id: string) => Promise<void>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toast: any
}) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ youtube_id: '', title: '' })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<EventVideo | null>(null)

  const openAdd = () => { setEditingId(null); setForm({ youtube_id: '', title: '' }); setShowForm(true) }
  const openEdit = (v: EventVideo) => { setEditingId(v.id); setForm({ youtube_id: v.youtube_id, title: v.title ?? '' }); setShowForm(true) }
  const cancel = () => { setShowForm(false); setEditingId(null) }

  const save = async () => {
    if (!form.youtube_id.trim()) return
    setSaving(true)
    try {
      if (editingId) {
        await onUpdate(editingId, { youtube_id: form.youtube_id.trim(), title: form.title.trim() || null })
        toast.success('Video updated')
      } else {
        await onAdd({ event_id: eventId, youtube_id: form.youtube_id.trim(), title: form.title.trim() || null })
        toast.success('Video added')
      }
      cancel()
    } catch (e) { toast.error(String(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-3">
      {items.length === 0 && !showForm && (
        <p className="text-sm text-slate-500 text-center py-6">No videos yet.</p>
      )}

      {items.map((v) => (
        <div key={v.id} className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg group">
          {/* YouTube thumbnail */}
          <img
            src={`https://img.youtube.com/vi/${v.youtube_id}/default.jpg`}
            alt=""
            className="h-10 w-[72px] object-cover rounded shrink-0 bg-slate-700"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-200 truncate">{v.title || 'Untitled'}</p>
            <p className="text-xs text-slate-500 font-mono">{v.youtube_id}</p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => openEdit(v)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDeleting(v)} className="text-red-400 hover:text-red-300">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}

      {showForm && (
        <div className="p-4 bg-slate-800/60 rounded-lg border border-slate-700 space-y-3">
          <Input
            label="YouTube Video ID *"
            placeholder="e.g. dQw4w9WgXcQ"
            value={form.youtube_id}
            onChange={(e) => setForm((f) => ({ ...f, youtube_id: e.target.value }))}
          />
          <Input
            label="Title"
            placeholder="e.g. Easter Sunday Sermon"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <div className="flex gap-3">
            <Button variant="ghost" onClick={cancel} className="flex-1" disabled={saving}>Cancel</Button>
            <Button onClick={save} loading={saving} className="flex-1">{editingId ? 'Save Changes' : 'Add Video'}</Button>
          </div>
        </div>
      )}

      {!showForm && (
        <Button variant="ghost" size="sm" onClick={openAdd}>
          <Plus className="h-3.5 w-3.5" /> Add Video
        </Button>
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return
          try { await onRemove(deleting.id); toast.success('Video removed') }
          catch (e) { toast.error(String(e)) }
          setDeleting(null)
        }}
        title="Remove Video"
        message={`Remove "${deleting?.title || deleting?.youtube_id}"?`}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Commentaries
// ─────────────────────────────────────────────────────────────
function CommentariesSection({
  eventId, items, onAdd, onUpdate, onRemove, toast,
}: {
  eventId: string
  items: EventCommentary[]
  onAdd: (c: Omit<EventCommentary, 'id' | 'created_at' | 'updated_at' | 'speaker'>) => Promise<void>
  onUpdate: (id: string, c: Partial<Omit<EventCommentary, 'id' | 'created_at' | 'updated_at' | 'speaker'>>) => Promise<void>
  onRemove: (id: string) => Promise<void>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toast: any
}) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ speaker_name: '', body: '' })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<EventCommentary | null>(null)

  const openAdd = () => { setEditingId(null); setForm({ speaker_name: '', body: '' }); setShowForm(true) }
  const openEdit = (c: EventCommentary) => { setEditingId(c.id); setForm({ speaker_name: c.speaker_name ?? '', body: c.body }); setShowForm(true) }
  const cancel = () => { setShowForm(false); setEditingId(null) }

  const save = async () => {
    if (!form.body.trim()) return
    setSaving(true)
    try {
      if (editingId) {
        await onUpdate(editingId, { speaker_name: form.speaker_name.trim() || null, body: form.body.trim() })
        toast.success('Commentary updated')
      } else {
        await onAdd({ event_id: eventId, speaker_id: null, speaker_name: form.speaker_name.trim() || null, body: form.body.trim() })
        toast.success('Commentary added')
      }
      cancel()
    } catch (e) { toast.error(String(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-3">
      {items.length === 0 && !showForm && (
        <p className="text-sm text-slate-500 text-center py-6">No commentaries yet.</p>
      )}

      {items.map((c) => (
        <div key={c.id} className="p-3 bg-slate-800 rounded-lg">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              {c.speaker_name && (
                <p className="text-xs text-cyan-500 font-medium mb-1">{c.speaker_name}</p>
              )}
              <p className="text-sm text-slate-200 whitespace-pre-wrap">{c.body}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setDeleting(c)} className="text-red-400 hover:text-red-300">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      ))}

      {showForm && (
        <div className="p-4 bg-slate-800/60 rounded-lg border border-slate-700 space-y-3">
          <Input
            label="Speaker Name"
            placeholder="e.g. Pastor John Mensah"
            value={form.speaker_name}
            onChange={(e) => setForm((f) => ({ ...f, speaker_name: e.target.value }))}
          />
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Commentary *</label>
            <textarea
              rows={4}
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              placeholder="Short nugget or quote from the speaker…"
              className="w-full rounded-lg bg-slate-800 border border-slate-600 text-slate-100 px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
            />
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={cancel} className="flex-1" disabled={saving}>Cancel</Button>
            <Button onClick={save} loading={saving} className="flex-1">{editingId ? 'Save Changes' : 'Add Commentary'}</Button>
          </div>
        </div>
      )}

      {!showForm && (
        <Button variant="ghost" size="sm" onClick={openAdd}>
          <Plus className="h-3.5 w-3.5" /> Add Commentary
        </Button>
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return
          try { await onRemove(deleting.id); toast.success('Commentary removed') }
          catch (e) { toast.error(String(e)) }
          setDeleting(null)
        }}
        title="Remove Commentary"
        message="Remove this commentary?"
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Photos
// ─────────────────────────────────────────────────────────────
function PhotosSection({
  eventId, items, onAdd, onUpdate, onRemove, toast,
}: {
  eventId: string
  items: EventPhoto[]
  onAdd: (p: Omit<EventPhoto, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  onUpdate: (id: string, p: Partial<Omit<EventPhoto, 'id' | 'created_at' | 'updated_at'>>) => Promise<void>
  onRemove: (id: string) => Promise<void>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toast: any
}) {
  const supabase = createClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingUrl, setEditingUrl] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<EventPhoto | null>(null)

  const openAdd = () => {
    setEditingId(null); setEditingUrl(null); setFile(null); setLocalPreview(null); setCaption(''); setShowForm(true)
  }
  const openEdit = (p: EventPhoto) => {
    setEditingId(p.id); setEditingUrl(p.url); setFile(null); setLocalPreview(null); setCaption(p.caption ?? ''); setShowForm(true)
  }
  const cancel = () => {
    setShowForm(false); setEditingId(null); setEditingUrl(null); setFile(null); setLocalPreview(null)
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setLocalPreview(URL.createObjectURL(f))
  }

  const save = async () => {
    if (!editingId && !file) return
    setUploading(true)
    try {
      let url = editingUrl ?? ''
      if (file) {
        const ext = file.name.split('.').pop()
        const path = `events/${eventId}/${crypto.randomUUID()}.${ext}`
        const { error: uploadError } = await supabase.storage.from('event-photos').upload(path, file)
        if (uploadError) throw new Error(uploadError.message)
        const { data } = supabase.storage.from('event-photos').getPublicUrl(path)
        url = data.publicUrl
      }
      if (editingId) {
        await onUpdate(editingId, { url, caption: caption.trim() || null })
        toast.success('Photo updated')
      } else {
        await onAdd({ event_id: eventId, url, caption: caption.trim() || null, taken_at: null })
        toast.success('Photo added')
      }
      cancel()
    } catch (e) { toast.error(String(e)) }
    finally { setUploading(false) }
  }

  const previewSrc = localPreview ?? editingUrl

  return (
    <div className="space-y-3">
      {items.length === 0 && !showForm && (
        <p className="text-sm text-slate-500 text-center py-6">No photos yet.</p>
      )}

      {/* Photo grid */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {items.map((p) => (
            <div key={p.id} className="group relative rounded-lg overflow-hidden bg-slate-800 border border-slate-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={p.caption ?? ''}
                className="w-full h-32 object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.2' }}
              />
              <div className="px-2 py-1.5">
                <p className="text-xs text-slate-400 truncate">{p.caption || <span className="italic text-slate-600">No caption</span>}</p>
              </div>
              <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
                <Button variant="secondary" size="sm" onClick={() => openEdit(p)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="danger" size="sm" onClick={() => setDeleting(p)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="p-4 bg-slate-800/60 rounded-lg border border-slate-700 space-y-3">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            aria-label="Upload photo"
            className="hidden"
            onChange={onFileChange}
          />
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Photo{!editingId && ' *'}
            </label>
            {previewSrc ? (
              <div className="relative rounded-lg overflow-hidden border border-slate-600 bg-slate-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewSrc} alt="" className="w-full h-40 object-cover" />
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="absolute bottom-2 right-2 px-2 py-1 text-xs bg-slate-900/80 text-slate-200 rounded hover:bg-slate-900 transition-colors"
                >
                  Replace
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="w-full h-28 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-600 text-slate-500 hover:border-cyan-500 hover:text-cyan-400 transition-colors"
              >
                <Image className="h-6 w-6" />
                <span className="text-sm">Click to pick a photo</span>
              </button>
            )}
          </div>
          <Input
            label="Caption"
            placeholder="e.g. Worship team during praise session"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
          <div className="flex gap-3">
            <Button variant="ghost" onClick={cancel} className="flex-1" disabled={uploading}>Cancel</Button>
            <Button
              onClick={save}
              loading={uploading}
              className="flex-1"
              disabled={!editingId && !file}
            >
              {editingId ? 'Save Changes' : 'Upload & Add'}
            </Button>
          </div>
        </div>
      )}

      {!showForm && (
        <Button variant="ghost" size="sm" onClick={openAdd}>
          <Plus className="h-3.5 w-3.5" /> Add Photo
        </Button>
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return
          try { await onRemove(deleting.id); toast.success('Photo removed') }
          catch (e) { toast.error(String(e)) }
          setDeleting(null)
        }}
        title="Remove Photo"
        message="Remove this photo?"
      />
    </div>
  )
}
