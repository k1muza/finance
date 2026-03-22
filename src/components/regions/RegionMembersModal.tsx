'use client'

import { useState, useEffect } from 'react'
import { X, UserPlus, Search } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { Region, Person } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  region: Region | null
}

export function RegionMembersModal({ open, onClose, region }: Props) {
  const supabase = createClient()
  const toast = useToast()
  const [members, setMembers] = useState<Person[]>([])
  const [allPeople, setAllPeople] = useState<Person[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !region) return
    loadMembers()
    loadAllPeople()
  }, [open, region]) // eslint-disable-line

  const loadMembers = async () => {
    if (!region) return
    const { data } = await supabase
      .from('people')
      .select('*, department:departments(id, name)')
      .eq('region_id', region.id)
      .order('name')
    setMembers(data ?? [])
  }

  const loadAllPeople = async () => {
    const { data } = await supabase
      .from('people')
      .select('*, department:departments(id, name)')
      .order('name')
    setAllPeople(data ?? [])
  }

  const addMember = async (person: Person) => {
    setLoading(true)
    try {
      await supabase.from('people').update({ region_id: region!.id }).eq('id', person.id)
      await loadMembers()
      await loadAllPeople()
      toast.success(`${person.name} added to ${region!.name}`)
    } catch {
      toast.error('Failed to add member')
    } finally {
      setLoading(false)
    }
  }

  const removeMember = async (person: Person) => {
    setLoading(true)
    try {
      await supabase.from('people').update({ region_id: null }).eq('id', person.id)
      await loadMembers()
      await loadAllPeople()
      toast.success(`${person.name} removed from ${region!.name}`)
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

  if (!region) return null

  return (
    <Modal open={open} onClose={onClose} title={`${region.name} — Members`} size="lg">
      <div className="space-y-5">
        {/* Current members */}
        <div>
          <h3 className="text-sm font-medium text-slate-400 mb-2">
            Members ({members.length})
          </h3>
          {members.length === 0 ? (
            <p className="text-slate-500 text-sm py-3 text-center">No members yet</p>
          ) : (
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-800">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm text-slate-100 truncate">{m.name}</span>
                    {m.gender && (
                      <Badge variant={m.gender === 'male' ? 'teal' : m.gender === 'female' ? 'purple' : 'default'}>
                        {m.gender}
                      </Badge>
                    )}
                    {m.department && (
                      <span className="text-xs text-slate-500 truncate">{m.department.name}</span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeMember(m)}
                    disabled={loading}
                    className="text-red-400 hover:text-red-300 shrink-0"
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
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg">
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search people…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none flex-1"
            />
          </div>
          <div className="mt-2 space-y-1 max-h-52 overflow-y-auto">
            {available.length === 0 ? (
              <p className="text-slate-500 text-sm py-3 text-center">No available people</p>
            ) : (
              available.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-800 transition">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm text-slate-100 truncate">{p.name}</span>
                    {p.region_id && (
                      <span className="text-xs text-yellow-500 shrink-0">(other region)</span>
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
