'use client'

import { useState, useEffect } from 'react'
import { SlideOver } from '@/components/ui/SlideOver'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Person, Region, Department } from '@/types'

interface PersonSlideOverProps {
  open: boolean
  onClose: () => void
  onSave: (values: Partial<Person>) => Promise<void>
  initial?: Person | null
  regions: Region[]
  departments: Department[]
}

export function PersonSlideOver({ open, onClose, onSave, initial, regions, departments }: PersonSlideOverProps) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    gender: '',
    region_id: '',
    department_id: '',
    contribution: '0',
  })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name,
        phone: initial.phone ?? '',
        gender: initial.gender ?? '',
        region_id: initial.region_id ?? '',
        department_id: initial.department_id ?? '',
        contribution: String(initial.contribution),
      })
    } else {
      setForm({ name: '', phone: '', gender: '', region_id: '', department_id: '', contribution: '0' })
    }
    setErrors({})
  }, [initial, open])

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (isNaN(Number(form.contribution)) || Number(form.contribution) < 0)
      e.contribution = 'Must be a valid positive number'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      await onSave({
        name: form.name.trim(),
        phone: form.phone || null,
        gender: (form.gender as Person['gender']) || null,
        region_id: form.region_id || null,
        department_id: form.department_id || null,
        contribution: Number(form.contribution),
      })
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const set = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }))

  return (
    <SlideOver open={open} onClose={onClose} title={initial ? 'Edit Person' : 'Add Person'}>
      <div className="space-y-4">
        <Input
          label="Full Name *"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          error={errors.name}
          placeholder="John Doe"
        />
        <Input
          label="Phone Number"
          value={form.phone}
          onChange={(e) => set('phone', e.target.value)}
          placeholder="+1 234 567 8900"
          type="tel"
        />
        <Select
          label="Gender"
          value={form.gender}
          onChange={(e) => set('gender', e.target.value)}
          placeholder="Select gender"
          options={[
            { value: 'male', label: 'Male' },
            { value: 'female', label: 'Female' },
            { value: 'other', label: 'Other' },
          ]}
        />
        <Select
          label="Region"
          value={form.region_id}
          onChange={(e) => set('region_id', e.target.value)}
          placeholder="Select region"
          options={regions.map((r) => ({ value: r.id, label: r.name }))}
        />
        <Select
          label="Department"
          value={form.department_id}
          onChange={(e) => set('department_id', e.target.value)}
          placeholder="Select department"
          options={departments.map((d) => ({ value: d.id, label: d.name }))}
        />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-300">Contribution (USD)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.contribution}
              onChange={(e) => set('contribution', e.target.value)}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 pl-7 pr-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          {errors.contribution && <p className="text-xs text-red-400">{errors.contribution}</p>}
        </div>

        <div className="flex gap-3 pt-4 border-t border-slate-700">
          <Button variant="ghost" onClick={onClose} className="flex-1" disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={loading} className="flex-1">
            {initial ? 'Save Changes' : 'Add Person'}
          </Button>
        </div>
      </div>
    </SlideOver>
  )
}
