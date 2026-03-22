'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePeople } from '@/hooks/usePeople'
import { useRegions } from '@/hooks/useRegions'
import { useDepartments } from '@/hooks/useDepartments'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { PersonForm, PersonFormValues } from '@/components/people/PersonForm'
import { Button } from '@/components/ui/Button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Person } from '@/types'

const empty: PersonFormValues = { name: '', phone: '', gender: '', region_id: '', department_id: '' }

export default function NewPersonPage() {
  const router = useRouter()
  const toast = useToast()
  const { districtId, isAdmin } = useAuth()
  const { create } = usePeople()
  const { data: regions } = useRegions(isAdmin ? undefined : districtId ?? undefined)
  const { data: departments } = useDepartments()

  const [form, setForm] = useState<PersonFormValues>(empty)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const set = (field: keyof PersonFormValues, value: string) =>
    setForm((f) => ({ ...f, [field]: value }))

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Name is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      await create({
        name: form.name.trim(),
        phone: form.phone || null,
        gender: (form.gender as Person['gender']) || null,
        region_id: form.region_id || null,
        department_id: form.department_id || null,
        contribution: 0,
      })
      toast.success('Person added')
      router.push('/dashboard/people')
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/people"
          className="text-slate-400 hover:text-slate-100 transition"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Add Person</h1>
          <p className="text-sm text-slate-400 mt-0.5">Fill in the details and save</p>
        </div>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-6">
        <PersonForm
          values={form}
          errors={errors}
          regions={regions}
          departments={departments}
          onChange={set}
        />

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700">
          <Link href="/dashboard/people">
            <Button variant="ghost" disabled={saving}>Cancel</Button>
          </Link>
          <Button onClick={handleSave} loading={saving}>
            Save Person
          </Button>
        </div>
      </div>
    </div>
  )
}
