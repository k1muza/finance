'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePeople } from '@/hooks/usePeople'
import { useRegions } from '@/hooks/useRegions'
import { useDepartments } from '@/hooks/useDepartments'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PeopleFilters } from '@/components/people/PeopleFilters'
import { PeopleTable } from '@/components/people/PeopleTable'
import { Button } from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/Spinner'
import { Person } from '@/types'
import { UserPlus } from 'lucide-react'

export default function PeoplePage() {
  const router = useRouter()
  const { districtId, isAdmin } = useAuth()
  const [filters, setFilters] = useState({ search: '', gender: '', regionId: '', departmentId: '' })
  const [confirm, setConfirm] = useState<{ open: boolean; person: Person | null }>({ open: false, person: null })
  const [deleting, setDeleting] = useState(false)

  const { data: people, loading, remove } = usePeople({
    search: filters.search,
    gender: filters.gender,
    region_id: filters.regionId,
    department_id: filters.departmentId,
  }, districtId)
  const { data: regions } = useRegions(isAdmin ? undefined : districtId ?? undefined)
  const { data: departments } = useDepartments()
  const toast = useToast()

  const handleDelete = async () => {
    if (!confirm.person) return
    setDeleting(true)
    try {
      await remove(confirm.person.id)
      toast.success('Person removed')
      setConfirm({ open: false, person: null })
    } catch (e) {
      toast.error(String(e))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">People</h1>
          <p className="text-sm text-slate-400 mt-1">{people.length} attendee{people.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => router.push('/dashboard/people/new')}>
          <UserPlus className="h-4 w-4" /> Add Person
        </Button>
      </div>

      <PeopleFilters
        search={filters.search}
        gender={filters.gender}
        regionId={filters.regionId}
        departmentId={filters.departmentId}
        regions={regions}
        departments={departments}
        onChange={(field, value) => setFilters((f) => ({ ...f, [field]: value }))}
      />

      {loading ? (
        <PageSpinner />
      ) : (
        <PeopleTable
          people={people}
          onEdit={(p) => router.push(`/dashboard/people/${p.id}`)}
          onDelete={(p) => setConfirm({ open: true, person: p })}
        />
      )}

      <ConfirmDialog
        open={confirm.open}
        onClose={() => setConfirm({ open: false, person: null })}
        onConfirm={handleDelete}
        title="Remove Person"
        message={`Are you sure you want to remove "${confirm.person?.name}"? This cannot be undone.`}
        loading={deleting}
      />
    </div>
  )
}
