'use client'

import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useCertificates } from '@/hooks/useCertificates'
import { CertificateBadge } from './CertificateBadge'
import { Certificate } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
}

export function CertificatesPanel({ open, onClose }: Props) {
  const { certificates, loading, update } = useCertificates()
  const toast = useToast()
  const [editing, setEditing] = useState<Certificate | null>(null)
  const [form, setForm] = useState({ min_amount: '', max_amount: '' })
  const [saving, setSaving] = useState(false)

  const openEdit = (c: Certificate) => {
    setEditing(c)
    setForm({
      min_amount: c.min_amount != null ? String(c.min_amount) : '',
      max_amount: c.max_amount != null ? String(c.max_amount) : '',
    })
  }

  const cancelEdit = () => setEditing(null)

  const save = async () => {
    if (!editing) return
    setSaving(true)
    try {
      await update(editing.id, {
        min_amount: form.min_amount !== '' ? Number(form.min_amount) : null,
        max_amount: form.max_amount !== '' ? Number(form.max_amount) : null,
      })
      toast.success('Certificate updated')
      setEditing(null)
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSaving(false)
    }
  }

  const formatRange = (c: Certificate) => {
    if (c.is_grand_prize) return 'Rank #1 — Best Overall'
    const min = c.min_amount != null ? `$${c.min_amount}` : '—'
    const max = c.max_amount != null ? `$${c.max_amount}` : '∞'
    return `${min} – ${max}`
  }

  return (
    <Modal open={open} onClose={onClose} title="Certificates" size="sm">
      {loading ? (
        <p className="text-sm text-slate-400 py-4">Loading…</p>
      ) : (
        <div className="space-y-2">
          {certificates.map((c) => (
            <div key={c.id} className="p-3 bg-slate-800 rounded-lg">
              {editing?.id === c.id ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <CertificateBadge name={c.name} />
                  </div>
                  {c.is_grand_prize ? (
                    <p className="text-xs text-slate-500">Grand Prize is always awarded to rank #1 — no amount range applies.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        label="Min amount"
                        type="number"
                        min={0}
                        placeholder="e.g. 25"
                        value={form.min_amount}
                        onChange={(e) => setForm((f) => ({ ...f, min_amount: e.target.value }))}
                      />
                      <Input
                        label="Max amount"
                        type="number"
                        min={0}
                        placeholder="leave blank for ∞"
                        value={form.max_amount}
                        onChange={(e) => setForm((f) => ({ ...f, max_amount: e.target.value }))}
                      />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={saving} className="flex-1">Cancel</Button>
                    <Button size="sm" onClick={save} loading={saving} disabled={c.is_grand_prize} className="flex-1">Save</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <CertificateBadge name={c.name} />
                    <span className="text-xs text-slate-500 truncate">{formatRange(c)}</span>
                  </div>
                  {!c.is_grand_prize && (
                    <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
