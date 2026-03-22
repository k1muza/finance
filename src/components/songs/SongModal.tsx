'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Song } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  onSave: (values: Omit<Song, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  initial: Song | null
}

const COMMON_KEYS = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'Db', 'Eb', 'Gb', 'Ab', 'Bb',
  'Cm', 'Dm', 'Em', 'Fm', 'Gm', 'Am', 'Bm']

const blank = { title: '', author: '', song_key: '', lyrics: '', sort_order: 0, published: false }

export function SongModal({ open, onClose, onSave, initial }: Props) {
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(initial ? {
      title: initial.title,
      author: initial.author ?? '',
      song_key: initial.song_key ?? '',
      lyrics: initial.lyrics ?? '',
      sort_order: initial.sort_order,
      published: initial.published,
    } : blank)
  }, [open, initial])

  const set = (key: keyof typeof form, value: string | number | boolean) =>
    setForm((f) => ({ ...f, [key]: value }))

  const handleSave = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      await onSave({
        title: form.title.trim(),
        author: form.author.trim() || null,
        song_key: form.song_key.trim() || null,
        lyrics: form.lyrics.trim() || null,
        sort_order: Number(form.sort_order),
        published: form.published,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Song' : 'New Song'} size="lg">
      <div className="space-y-4">
        {/* Title */}
        <Input
          label="Title *"
          placeholder="e.g. Great Is Thy Faithfulness"
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
        />

        {/* Author + Key */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Author / Artist"
            placeholder="e.g. Thomas Chisholm"
            value={form.author}
            onChange={(e) => set('author', e.target.value)}
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-300">Key</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. G"
                value={form.song_key}
                onChange={(e) => set('song_key', e.target.value)}
                className="w-20 rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
              />
              <div className="flex flex-wrap gap-1 items-center">
                {COMMON_KEYS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => set('song_key', k)}
                    className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
                      form.song_key === k
                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200'
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Lyrics */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-300">Lyrics</label>
          <textarea
            rows={14}
            value={form.lyrics}
            onChange={(e) => set('lyrics', e.target.value)}
            placeholder={"[Verse 1]\nGreat is Thy faithfulness, O God my Father\n...\n\n[Chorus]\n..."}
            className="w-full rounded-lg bg-slate-800 border border-slate-700 text-slate-100 px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-y font-mono leading-relaxed"
          />
          <p className="text-xs text-slate-500">Use labels like [Verse 1], [Chorus], [Bridge] to structure the lyrics.</p>
        </div>

        {/* Sort order + published */}
        <div className="flex items-center gap-4">
          <div className="w-32">
            <Input
              label="Sort order"
              type="number"
              min={0}
              value={String(form.sort_order)}
              onChange={(e) => set('sort_order', e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer mt-5">
            <input
              type="checkbox"
              checked={form.published}
              onChange={(e) => set('published', e.target.checked)}
              className="w-4 h-4 rounded accent-cyan-500"
            />
            <span className="text-sm text-slate-300">Published</span>
          </label>
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="ghost" onClick={onClose} className="flex-1" disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} loading={saving} className="flex-1" disabled={!form.title.trim()}>
            {initial ? 'Save Changes' : 'Create Song'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
