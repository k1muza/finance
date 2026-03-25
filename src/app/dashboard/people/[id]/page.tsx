'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useRegions } from '@/hooks/useRegions'
import { useDepartments } from '@/hooks/useDepartments'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { PersonForm, PersonFormValues } from '@/components/people/PersonForm'
import { ContributionsList } from '@/components/people/ContributionsList'
import { Button } from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/Spinner'
import { createClient } from '@/lib/supabase/client'
import { Person } from '@/types'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function EditPersonPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const toast = useToast()
  const { districtId, isAdmin } = useAuth()
  const { data: regions } = useRegions(isAdmin ? undefined : districtId ?? undefined)
  const { data: departments } = useDepartments()
  const supabase = createClient()

  const [person, setPerson] = useState<Person | null>(null)
  const [loadingPerson, setLoadingPerson] = useState(true)
  const [form, setForm] = useState<PersonFormValues>({ name: '', phone: '', gender: '', region_id: '', department_id: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const fetchPerson = useCallback(async () => {
    setLoadingPerson(true)
    const { data, error } = await supabase
      .from('people')
      .select('*, region:regions(id,name), department:departments(id,name)')
      .eq('id', id)
      .single()
    if (error || !data) {
      toast.error('Person not found')
      router.push('/dashboard/people')
      return
    }
    setPerson(data)
    setForm({
      name: data.name,
      phone: data.phone ?? '',
      gender: data.gender ?? '',
      region_id: data.region_id ?? '',
      department_id: data.department_id ?? '',
    })
    setLoadingPerson(false)
  }, [id]) // eslint-disable-line

  useEffect(() => { fetchPerson() }, [fetchPerson])

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
      const { error } = await supabase
        .from('people')
        .update({
          name: form.name.trim(),
          phone: form.phone || null,
          gender: (form.gender as Person['gender']) || null,
          district_id: person?.district_id ?? districtId ?? null,
          region_id: form.region_id || null,
          department_id: form.department_id || null,
        })
        .eq('id', id)
      if (error) throw new Error(error.message)
      toast.success('Person updated')
      await fetchPerson()
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSaving(false)
    }
  }

  if (loadingPerson) return <PageSpinner />

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/people" className="text-slate-400 hover:text-slate-100 transition">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-100">{person?.name}</h1>
          <p className="text-sm text-slate-400 mt-0.5">Edit person details and manage contributions</p>
        </div>
      </div>

      {/* Details card */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-6">
        <h2 className="text-lg font-semibold text-slate-100">Details</h2>
        <PersonForm
          values={form}
          errors={errors}
          regions={regions}
          departments={departments}
          onChange={set}
        />
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700">
          <Button onClick={handleSave} loading={saving}>
            Save Changes
          </Button>
        </div>
      </div>

      {/* Contributions card */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <ContributionsList personId={id} />
      </div>
    </div>
  )
}
