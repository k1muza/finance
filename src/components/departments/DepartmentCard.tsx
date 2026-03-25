'use client'

import { Department } from '@/types'
import { Button } from '@/components/ui/Button'
import { Pencil, Trash2, Users, Settings, Images } from 'lucide-react'

interface DepartmentCardProps {
  department: Department
  onManage: () => void
  onPhotos: () => void
  onEdit: () => void
  onDelete: () => void
  isAdmin?: boolean
}

export function DepartmentCard({ department, onManage, onPhotos, onEdit, onDelete, isAdmin }: DepartmentCardProps) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-100 truncate">{department.name}</h3>
          <p className="text-sm text-slate-400 mt-0.5">HOD: {department.hod?.name ?? '—'}</p>
        </div>
        {isAdmin && (
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-400 hover:text-red-300">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Users className="h-4 w-4" />
        <span>{department.member_count ?? 0} member{department.member_count !== 1 ? 's' : ''}</span>
      </div>

      <div className="flex gap-2 mt-1">
        <Button variant="secondary" size="sm" onClick={onManage} className="flex-1">
          <Settings className="h-4 w-4" /> Members
        </Button>
        <Button variant="ghost" size="sm" onClick={onPhotos} className="flex-1">
          <Images className="h-4 w-4" /> Photos
        </Button>
      </div>
    </div>
  )
}
