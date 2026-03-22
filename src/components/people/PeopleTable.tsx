'use client'

import { Person } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { Pencil, Trash2 } from 'lucide-react'

interface PeopleTableProps {
  people: Person[]
  onEdit: (person: Person) => void
  onDelete: (person: Person) => void
}

export function PeopleTable({ people, onEdit, onDelete }: PeopleTableProps) {
  if (people.length === 0) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
        <p className="text-slate-500">No people found. Add someone to get started.</p>
      </div>
    )
  }

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Name</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Phone</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Gender</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Region</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Department</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Contribution</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition">
                <td className="px-4 py-3 font-medium text-slate-100">
                  <button type="button" onClick={() => onEdit(p)} className="hover:text-cyan-400 transition text-left">
                    {p.name}
                  </button>
                </td>
                <td className="px-4 py-3 text-slate-400">{p.phone ?? '—'}</td>
                <td className="px-4 py-3">
                  {p.gender ? (
                    <Badge variant={p.gender === 'male' ? 'teal' : p.gender === 'female' ? 'purple' : 'default'}>
                      {p.gender}
                    </Badge>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-400">{(p.region as { name?: string })?.name ?? '—'}</td>
                <td className="px-4 py-3 text-slate-400">{(p.department as { name?: string })?.name ?? '—'}</td>
                <td className="px-4 py-3 text-right font-semibold text-cyan-400">
                  {formatCurrency(p.contribution)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => onEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onDelete(p)} className="text-red-400 hover:text-red-300">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
