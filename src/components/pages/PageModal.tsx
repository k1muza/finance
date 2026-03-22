'use client'

import { useState, useEffect, useRef } from 'react'
import { Image } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { RichTextEditor } from './RichTextEditor'
import { Page } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  onSave: (values: Omit<Page, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  initial: Page | null
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export function PageModal({ open, onClose, onSave, initial }: Props) {
  const supabase = createClient()
  const toast = useToast()
  const imageInputRef = useRef<HTMLInputElement>(null)

  const blank = { title: '', slug: '', content: '', icon_class: '', sort_order: 0, published: false, featured_image_url: '' }
  const [form, setForm] = useState(blank)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [slugManual, setSlugManual] = useState(false)

  useEffect(() => {
    if (!open) return
    if (initial) {
      setForm({
        title: initial.title,
        slug: initial.slug,
        content: initial.content ?? '',
        icon_class: initial.icon_class ?? '',
        sort_order: initial.sort_order,
        published: initial.published,
        featured_image_url: initial.featured_image_url ?? '',
      })
      setImagePreview(initial.featured_image_url ?? null)
      setSlugManual(true)
    } else {
      setForm(blank)
      setImagePreview(null)
      setSlugManual(false)
    }
    setImageFile(null)
  }, [open, initial]) // eslint-disable-line

  const set = (key: keyof typeof form, value: string | number | boolean) =>
    setForm((f) => ({ ...f, [key]: value }))

  const onTitleChange = (title: string) => {
    set('title', title)
    if (!slugManual) set('slug', slugify(title))
  }

  const onImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setImageFile(f)
    setImagePreview(URL.createObjectURL(f))
  }

  const handleSave = async () => {
    if (!form.title.trim() || !form.slug.trim()) return
    setSaving(true)
    try {
      let imageUrl = form.featured_image_url

      if (imageFile) {
        const ext = imageFile.name.split('.').pop()
        const path = `${crypto.randomUUID()}.${ext}`
        const { error: uploadErr } = await supabase.storage.from('page-images').upload(path, imageFile)
        if (uploadErr) throw new Error(uploadErr.message)
        const { data } = supabase.storage.from('page-images').getPublicUrl(path)
        imageUrl = data.publicUrl
      }

      await onSave({
        title: form.title.trim(),
        slug: form.slug.trim(),
        content: form.content || null,
        featured_image_url: imageUrl || null,
        icon_class: form.icon_class.trim() || null,
        sort_order: Number(form.sort_order),
        published: form.published,
      })
      onClose()
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSaving(false)
    }
  }

  const iconPreview = form.icon_class.trim()

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Page' : 'New Page'} size="xl">
      <div className="space-y-5">
        {/* Title + slug */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Title *"
            placeholder="e.g. About the Conference"
            value={form.title}
            onChange={(e) => onTitleChange(e.target.value)}
          />
          <Input
            label="Slug *"
            placeholder="e.g. about-the-conference"
            value={form.slug}
            onChange={(e) => { setSlugManual(true); set('slug', e.target.value) }}
          />
        </div>

        {/* Icon class */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-300">Material Design Icon</label>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Input
                placeholder="e.g. mdi mdi-home"
                value={form.icon_class}
                onChange={(e) => set('icon_class', e.target.value)}
              />
            </div>
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 shrink-0">
              {iconPreview
                ? <i className={`${iconPreview} text-xl text-cyan-400`} />
                : <span className="text-slate-600 text-xs">none</span>}
            </div>
          </div>
          <p className="text-xs text-slate-500">Enter the full class string, e.g. <code className="text-slate-400">mdi mdi-home</code></p>
        </div>

        {/* Featured image */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-300">Featured Image</label>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            aria-label="Upload featured image"
            className="hidden"
            onChange={onImageChange}
          />
          {imagePreview ? (
            <div className="relative rounded-lg overflow-hidden border border-slate-700 bg-slate-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview} alt="" className="w-full h-40 object-cover" />
              <div className="absolute bottom-2 right-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="px-2 py-1 text-xs bg-slate-900/80 text-slate-200 rounded hover:bg-slate-900 transition-colors"
                >
                  Replace
                </button>
                <button
                  type="button"
                  onClick={() => { setImageFile(null); setImagePreview(null); set('featured_image_url', '') }}
                  className="px-2 py-1 text-xs bg-red-900/80 text-red-300 rounded hover:bg-red-900 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="w-full h-24 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-600 text-slate-500 hover:border-cyan-500 hover:text-cyan-400 transition-colors"
            >
              <Image className="h-5 w-5" />
              <span className="text-sm">Click to upload featured image</span>
            </button>
          )}
        </div>

        {/* Rich text content */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-300">Content</label>
          <RichTextEditor
            value={form.content}
            onChange={(html) => set('content', html)}
          />
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
          <Button onClick={handleSave} loading={saving} className="flex-1" disabled={!form.title.trim() || !form.slug.trim()}>
            {initial ? 'Save Changes' : 'Create Page'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
