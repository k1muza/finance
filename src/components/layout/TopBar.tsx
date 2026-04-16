'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useDistricts } from '@/hooks/useDistricts'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { UiSettingsButton } from '@/components/layout/UiSettingsButton'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { ShieldCheck, MapPin, ChevronDown, Check, Plus, User, LogOut, Landmark } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useRouter } from 'next/navigation'

interface DistrictStat {
  id: string
  name: string
  transaction_count: number
}

function useDistrictStats() {
  const [districts, setDistricts] = useState<DistrictStat[]>([])
  const supabase = createClient()

  const load = useCallback(async () => {
    const [{ data: txns }, { data: allDistricts }] = await Promise.all([
      supabase.from('cashbook_transactions').select('district_id').eq('status', 'posted'),
      supabase.from('districts').select('id, name').order('name'),
    ])

    if (!allDistricts) return

    const countMap: Record<string, number> = {}
    for (const row of txns ?? []) {
      if (!row.district_id) continue
      countMap[row.district_id] = (countMap[row.district_id] ?? 0) + 1
    }

    setDistricts(
      allDistricts.map((district) => ({
        id: district.id,
        name: district.name,
        transaction_count: countMap[district.id] ?? 0,
      }))
    )
  }, []) // eslint-disable-line

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  return { districts, reload: load }
}

function AdminDistrictDropdown() {
  const { districtId: activeDistrictId, setActiveDistrictId } = useAuth()
  const { districts, reload } = useDistrictStats()
  const { create: createDistrict } = useDistricts()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = districts.find((district) => district.id === activeDistrictId) ?? null

  const handleCreate = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      await createDistrict({ name: newName.trim() })
      await reload()
      toast.success('District created')
      setNewName('')
      setAddOpen(false)
    } catch (e) {
      toast.error(String(e))
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition-colors bg-cyan-500/10 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/15"
      >
        <MapPin className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
        <span className="font-medium max-w-[160px] truncate">
          {selected ? selected.name : 'All districts'}
        </span>
        {selected ? (
          <span className="text-xs text-cyan-500/70 font-normal">{selected.transaction_count}</span>
        ) : (
          <span className="text-xs text-cyan-500/70 font-normal">All</span>
        )}
        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="max-h-64 overflow-y-auto">
            <button
              type="button"
              onClick={() => { setActiveDistrictId(null); setOpen(false) }}
              className={cn(
                'flex items-center justify-between w-full px-3 py-2.5 text-sm transition-colors',
                !activeDistrictId
                  ? 'bg-cyan-500/10 text-cyan-300'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
              )}
            >
              <span className="flex items-center gap-2 min-w-0">
                <Landmark className={cn('h-3.5 w-3.5 shrink-0', !activeDistrictId ? 'text-cyan-400' : 'text-slate-500')} />
                <span className="truncate">All districts</span>
              </span>
              {!activeDistrictId && <Check className="h-3.5 w-3.5 text-cyan-400" />}
            </button>
            {districts.map((district) => {
              const isSelected = activeDistrictId === district.id
              return (
                <button
                  key={district.id}
                  type="button"
                  onClick={() => { setActiveDistrictId(district.id); setOpen(false) }}
                  className={cn(
                    'flex items-center justify-between w-full px-3 py-2.5 text-sm transition-colors',
                    isSelected
                      ? 'bg-cyan-500/10 text-cyan-300'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                  )}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <MapPin className={cn('h-3.5 w-3.5 shrink-0', isSelected ? 'text-cyan-400' : 'text-slate-500')} />
                    <span className="truncate">{district.name}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0 ml-2">
                    <span className={cn('text-xs', isSelected ? 'text-cyan-500/70' : 'text-slate-500')}>
                      {district.transaction_count}
                    </span>
                    {isSelected && <Check className="h-3.5 w-3.5 text-cyan-400" />}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="border-t border-slate-800 p-1.5">
            <button
              type="button"
              onClick={() => { setOpen(false); setAddOpen(true) }}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              New District
            </button>
          </div>
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="New District" size="sm">
        <div className="space-y-4">
          <Input
            label="District Name *"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Northern District"
          />
          <p className="text-xs text-slate-500">Income, expenditure, and reports will be recorded under this district.</p>
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" onClick={() => setAddOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleCreate} loading={saving} className="flex-1">Create District</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function UserMenu() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const displayName = user?.user_metadata?.full_name
    ?? user?.email?.split('@')[0]
    ?? 'Account'

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  const handleLogout = async () => {
    setOpen(false)
    await logout()
    router.push('/login')
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition-colors bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600 hover:text-slate-100"
      >
        <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        <span className="max-w-30 truncate font-medium">{displayName}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 text-slate-500 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-44 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden py-1">
          <div className="px-3 py-2 border-b border-slate-800">
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-300 hover:bg-red-500/10 hover:text-red-400 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

export function TopBar() {
  const { isAdmin, district } = useAuth()
  const { districts: allDistricts } = useDistrictStats()

  if (isAdmin) {
    return (
      <header className="hidden md:block border-b border-slate-800 bg-slate-950">
        <div className="p-4 xl:p-6 max-w-6xl mx-auto flex items-center gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-100">District Finance Dashboard</p>
            <p className="text-xs text-slate-500 mt-1">Multi-district income and expenditure management</p>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-3 shrink-0">
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-cyan-400 font-medium">Admin</span>
            </span>
            <div className="w-px h-4 bg-slate-700" />
            <AdminDistrictDropdown />
            <div className="w-px h-4 bg-slate-700" />
            <UiSettingsButton />
            <div className="w-px h-4 bg-slate-700" />
            <UserMenu />
          </div>
        </div>
      </header>
    )
  }

  if (district) {
    const stat = allDistricts.find((item) => item.id === district.id)
    return (
      <header className="hidden md:block border-b border-slate-800 bg-slate-950">
        <div className="p-4 xl:p-6 max-w-6xl mx-auto flex items-center gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-100">District Finance Dashboard</p>
            <p className="text-xs text-slate-500 mt-1">District income and expenditure workspace</p>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sm">
              <MapPin className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
              <span className="text-slate-200 font-medium">{district.name}</span>
              {stat && <span className="text-xs text-slate-500 ml-0.5">{stat.transaction_count}</span>}
            </div>
            <div className="w-px h-4 bg-slate-700" />
            <UiSettingsButton />
            <div className="w-px h-4 bg-slate-700" />
            <UserMenu />
          </div>
        </div>
      </header>
    )
  }

  return (
    <header className="hidden md:block border-b border-slate-800 bg-slate-950">
      <div className="p-4 xl:p-6 max-w-6xl mx-auto flex items-center gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-100">District Finance Dashboard</p>
          <p className="text-xs text-slate-500 mt-1">Choose a district to continue working.</p>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3 shrink-0">
          <UiSettingsButton />
          <div className="w-px h-4 bg-slate-700" />
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
