'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Department } from '@/types'

interface DepartmentModalProps {
  open: boolean
  onClose: () => void
  onSave: (values: { name: string; hod: string }) => Promise<void>
  initial?: Department | null
}

export function DepartmentModal({ open, onClose, onSave, initial }: DepartmentModalProps) {
  const [name, setName] = useState('')
  const [hod, setHod] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ name?: string; hod?: string }>({})

  useEffect(() => {
    setName(initial?.name ?? '')
    setHod(initial?.hod ?? '')
    setErrors({})
  }, [initial, open])

  const handleSubmit = async () => {
    const e: { name?: string; hod?: string } = {}
    if (!name.trim()) e.name = 'Required'
    if (!hod.trim()) e.hod = 'Required'
    setErrors(e)
    if (Object.keys(e).length > 0) return

    setLoading(true)
    try {
      await onSave({ name: name.trim(), hod: hod.trim() })
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
        <Input
          label="Head of Department (HOD) *"
          value={hod}
          onChange={(e) => setHod(e.target.value)}
          error={errors.hod}
          placeholder="Full name"
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
