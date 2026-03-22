'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Department, Person } from '@/types'
import { createClient } from '@/lib/supabase/client'

interface DepartmentModalProps {
  open: boolean
  onClose: () => void
  onSave: (values: { name: string; hod_person_id: string | null }) => Promise<void>
  initial?: Department | null
}

export function DepartmentModal({ open, onClose, onSave, initial }: DepartmentModalProps) {
  const [name, setName] = useState('')
  const [hodPersonId, setHodPersonId] = useState<string>('')
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ name?: string }>({})
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('people')
      .select('id, name, phone, gender, region_id, department_id, created_at, updated_at')
      .order('name')
      .then(({ data }) => setPeople(data ?? []))
  }, []) // eslint-disable-line

  useEffect(() => {
    setName(initial?.name ?? '')
    setHodPersonId(initial?.hod?.id ?? '')
    setErrors({})
  }, [initial, open])

  const handleSubmit = async () => {
    const e: { name?: string } = {}
    if (!name.trim()) e.name = 'Required'
    setErrors(e)
    if (Object.keys(e).length > 0) return

    setLoading(true)
    try {
      await onSave({ name: name.trim(), hod_person_id: hodPersonId || null })
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Department' : 'New Department'} size="sm">
      <div className="space-y-4">
        <Input
          label="Department Name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          placeholder="e.g. Finance"
        />
        <Select
          label="Head of Department (HOD)"
          value={hodPersonId}
          onChange={(e) => setHodPersonId(e.target.value)}
          placeholder="— None —"
          options={people.map((p) => ({ value: p.id, label: p.name }))}
        />
        <div className="flex gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} className="flex-1" disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} loading={loading} className="flex-1">
            {initial ? 'Save' : 'Create'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
