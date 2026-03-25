'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Department, Person } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { X, UserPlus } from 'lucide-react'

interface DepartmentExpandModalProps {
  open: boolean
  onClose: () => void
  department: Department | null
  onRefresh: () => void
  districtId?: string | null
}

export function DepartmentExpandModal({ open, onClose, department, onRefresh, districtId }: DepartmentExpandModalProps) {
  const [members, setMembers] = useState<Person[]>([])
  const [allPeople, setAllPeople] = useState<Person[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const toast = useToast()

  useEffect(() => {
    if (!open || !department) return
    loadMembers()
    loadAllPeople()
  }, [open, department, districtId]) // eslint-disable-line

  const loadMembers = async () => {
    if (!department) return
    let query = supabase
      .from('people')
      .select('id, name, phone, gender, district_id, region_id, department_id, created_at, updated_at, region:regions(district_id)')
      .eq('department_id', department.id)
      .order('name')

    const { data } = await query

    // Filter to active district if set
    const filtered = districtId
      ? (data ?? []).filter((p) => (p.region as unknown as { district_id: string } | null)?.district_id === districtId)
      : (data ?? [])

    setMembers(filtered.map(({ region: _r, ...rest }) => rest as Person))
  }

  const loadAllPeople = async () => {
    let query = supabase
      .from('people')
      .select('id, name, phone, gender, district_id, region_id, department_id, created_at, updated_at, region:regions(district_id)')
      .order('name')

    if (districtId) {
      query = query.eq('regions.district_id', districtId)
    }

    const { data } = await query

    // Filter by district via joined region
    const filtered = districtId
      ? (data ?? []).filter((p) => (p.region as unknown as { district_id: string } | null)?.district_id === districtId)
      : (data ?? [])

    setAllPeople(filtered.map(({ region: _r, ...rest }) => rest as Person))
  }

  const addMember = async (person: Person) => {
    setLoading(true)
    try {
      await supabase.from('people').update({ department_id: department!.id }).eq('id', person.id)
      await loadMembers()
      await loadAllPeople()
      onRefresh()
      toast.success(`${person.name} added to ${department!.name}`)
    } catch {
      toast.error('Failed to add member')
    } finally {
      setLoading(false)
    }
  }

  const removeMember = async (person: Person) => {
    setLoading(true)
    try {
      await supabase.from('people').update({ department_id: null }).eq('id', person.id)
      await loadMembers()
      await loadAllPeople()
      onRefresh()
      toast.success(`${person.name} removed from ${department!.name}`)
    } catch {
      toast.error('Failed to remove member')
    } finally {
      setLoading(false)
    }
  }

  const memberIds = new Set(members.map((m) => m.id))
  const available = allPeople.filter(
    (p) => !memberIds.has(p.id) && p.name.toLowerCase().includes(search.toLowerCase())
  )

  if (!department) return null

  return (
    <Modal open={open} onClose={onClose} title={`${department.name} — Members`} size="lg">
      <div className="space-y-5">
        {/* Current members */}
        <div>
          <h3 className="text-sm font-medium text-slate-400 mb-2">
            Current Members ({members.length})
          </h3>
          {members.length === 0 ? (
            <p className="text-slate-500 text-sm py-3 text-center">No members yet</p>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-800">
                  <span className="text-sm text-slate-100">{m.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeMember(m)}
                    disabled={loading}
                    className="text-red-400 hover:text-red-300"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add members */}
        <div className="border-t border-slate-700 pt-4">
          <h3 className="text-sm font-medium text-slate-400 mb-2">Add Members</h3>
          <Input
            placeholder="Search people…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
            {available.length === 0 ? (
              <p className="text-slate-500 text-sm py-3 text-center">No available people</p>
            ) : (
              available.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-800 transition">
                  <div>
                    <span className="text-sm text-slate-100">{p.name}</span>
                    {p.department_id && (
                      <span className="ml-2 text-xs text-yellow-500">(in another dept)</span>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => addMember(p)} disabled={loading}>
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
