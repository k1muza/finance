'use client'

import { memo, useCallback, useMemo, useState } from 'react'
import { Person, Region, Department } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ContributionsList } from '@/components/people/ContributionsList'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { Pencil, Trash2, Check, X, DollarSign, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

interface PeopleTableProps {
  people: Person[]
  regions: Region[]
  departments: Department[]
  onUpdate: (id: string, values: Partial<Pick<Person, 'name' | 'phone' | 'gender' | 'region_id' | 'department_id'>>) => Promise<void>
  onDelete: (person: Person) => void
  onContributionsChange?: () => Promise<void> | void
}

interface DraftRow {
  name: string
  phone: string
  gender: string
  region_id: string
  department_id: string
}

type SortKey = 'name' | 'phone' | 'gender' | 'region' | 'department' | 'contribution'
type SortDirection = 'asc' | 'desc'

export const PeopleTable = memo(function PeopleTable({
  people,
  regions,
  departments,
  onUpdate,
  onDelete,
  onContributionsChange,
}: PeopleTableProps) {
  const toast = useToast()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<DraftRow>({ name: '', phone: '', gender: '', region_id: '', department_id: '' })
  const [saving, setSaving] = useState(false)
  const [contributionPersonId, setContributionPersonId] = useState<string | null>(null)
  const [contributionPersonName, setContributionPersonName] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const regionNameById = useMemo(() => new Map(regions.map((region) => [region.id, region.name])), [regions])
  const departmentNameById = useMemo(() => new Map(departments.map((department) => [department.id, department.name])), [departments])

  const getRegionName = useCallback((person: Person) => (
    (person.region as { name?: string } | null)?.name
    ?? (person.region_id ? regionNameById.get(person.region_id) : undefined)
    ?? ''
  ), [regionNameById])

  const getDepartmentName = useCallback((person: Person) => (
    (person.department as { name?: string } | null)?.name
    ?? (person.department_id ? departmentNameById.get(person.department_id) : undefined)
    ?? ''
  ), [departmentNameById])

  const compareText = (a: string, b: string) => {
    const left = a.trim()
    const right = b.trim()

    if (!left && !right) return 0
    if (!left) return 1
    if (!right) return -1

    return left.localeCompare(right, undefined, { sensitivity: 'base' })
  }

  const sortedPeople = useMemo(() => {
    const direction = sortDirection === 'asc' ? 1 : -1

    return [...people].sort((a, b) => {
      let comparison = 0

      switch (sortKey) {
        case 'name':
          comparison = compareText(a.name, b.name)
          break
        case 'phone':
          comparison = compareText(a.phone ?? '', b.phone ?? '')
          break
        case 'gender':
          comparison = compareText(a.gender ?? '', b.gender ?? '')
          break
        case 'region':
          comparison = compareText(getRegionName(a), getRegionName(b))
          break
        case 'department':
          comparison = compareText(getDepartmentName(a), getDepartmentName(b))
          break
        case 'contribution':
          comparison = (a.contribution ?? 0) - (b.contribution ?? 0)
          break
      }

      if (comparison === 0) {
        comparison = compareText(a.name, b.name)
      }

      return comparison * direction
    })
  }, [people, sortDirection, sortKey, getRegionName, getDepartmentName])

  const toggleSort = (nextKey: SortKey) => {
    if (sortKey === nextKey) {
      setSortDirection((currentDirection) => currentDirection === 'asc' ? 'desc' : 'asc')
      return
    }

    setSortKey(nextKey)
    setSortDirection(nextKey === 'contribution' ? 'desc' : 'asc')
  }

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-slate-500" />
    }

    return sortDirection === 'asc'
      ? <ChevronUp className="h-3.5 w-3.5 text-cyan-400" />
      : <ChevronDown className="h-3.5 w-3.5 text-cyan-400" />
  }

  const renderSortableHeader = (key: SortKey, label: string, align: 'left' | 'right' = 'left') => (
    <th
      className={`px-4 py-3 text-slate-400 font-medium ${align === 'right' ? 'text-right' : 'text-left'}`}
      aria-sort={sortKey === key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className={`inline-flex items-center gap-1.5 transition hover:text-slate-200 ${align === 'right' ? 'ml-auto' : ''}`}
      >
        <span>{label}</span>
        {renderSortIcon(key)}
      </button>
    </th>
  )

  const startEdit = (person: Person) => {
    setEditingId(person.id)
    setDraft({
      name: person.name,
      phone: person.phone ?? '',
      gender: person.gender ?? '',
      region_id: person.region_id ?? (person.region as { id?: string })?.id ?? '',
      department_id: person.department_id ?? (person.department as { id?: string })?.id ?? '',
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const saveEdit = async (id: string) => {
    if (!draft.name.trim()) {
      toast.error('Name is required')
      return
    }

    setSaving(true)

    try {
      await onUpdate(id, {
        name: draft.name.trim(),
        phone: draft.phone.trim() || null,
        gender: (draft.gender as Person['gender']) || null,
        region_id: draft.region_id || null,
        department_id: draft.department_id || null,
      })
      setEditingId(null)
      toast.success('Saved')
    } catch (error) {
      toast.error(String(error))
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full rounded-md bg-slate-900 border border-slate-600 px-2 py-1 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500'
  const selectCls = inputCls

  if (people.length === 0) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
        <p className="text-slate-500">No people found. Add someone to get started.</p>
      </div>
    )
  }

  return (
    <>
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {renderSortableHeader('name', 'Name')}
                {renderSortableHeader('phone', 'Phone')}
                {renderSortableHeader('gender', 'Gender')}
                {renderSortableHeader('region', 'Region')}
                {renderSortableHeader('department', 'Department')}
                {renderSortableHeader('contribution', 'Contribution', 'right')}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {sortedPeople.map((person) => {
                const isEditing = editingId === person.id
                const regionName = getRegionName(person) || '-'
                const departmentName = getDepartmentName(person) || '-'

                return (
                  <tr
                    key={person.id}
                    className={`border-b border-slate-700/50 transition ${isEditing ? 'bg-slate-700/40' : 'hover:bg-slate-700/30'}`}
                  >
                    <td className="px-4 py-2 font-medium text-slate-100 min-w-[140px]">
                      {isEditing ? (
                        <input
                          className={inputCls}
                          value={draft.name}
                          onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                          autoFocus
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(person)}
                          className="hover:text-cyan-400 transition text-left"
                        >
                          {person.name}
                        </button>
                      )}
                    </td>

                    <td className="px-4 py-2 text-slate-400 min-w-[120px]">
                      {isEditing ? (
                        <input
                          className={inputCls}
                          value={draft.phone}
                          onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))}
                          placeholder="Optional"
                        />
                      ) : (
                        person.phone ?? '-'
                      )}
                    </td>

                    <td className="px-4 py-2 min-w-[110px]">
                      {isEditing ? (
                        <select
                          className={selectCls}
                          value={draft.gender}
                          onChange={(event) => setDraft((current) => ({ ...current, gender: event.target.value }))}
                        >
                          <option value="">-</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                      ) : person.gender ? (
                        <Badge variant={person.gender === 'male' ? 'teal' : person.gender === 'female' ? 'purple' : 'default'}>
                          {person.gender}
                        </Badge>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>

                    <td className="px-4 py-2 text-slate-400 min-w-[140px]">
                      {isEditing ? (
                        <select
                          className={selectCls}
                          value={draft.region_id}
                          onChange={(event) => setDraft((current) => ({ ...current, region_id: event.target.value }))}
                        >
                          <option value="">-- None --</option>
                          {regions.map((region) => (
                            <option key={region.id} value={region.id}>{region.name}</option>
                          ))}
                        </select>
                      ) : (
                        regionName
                      )}
                    </td>

                    <td className="px-4 py-2 text-slate-400 min-w-[140px]">
                      {isEditing ? (
                        <select
                          className={selectCls}
                          value={draft.department_id}
                          onChange={(event) => setDraft((current) => ({ ...current, department_id: event.target.value }))}
                        >
                          <option value="">-- None --</option>
                          {departments.map((department) => (
                            <option key={department.id} value={department.id}>{department.name}</option>
                          ))}
                        </select>
                      ) : (
                        departmentName
                      )}
                    </td>

                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setContributionPersonId(person.id)
                          setContributionPersonName(person.name)
                        }}
                        className="font-semibold text-cyan-400 hover:text-cyan-300 transition flex items-center gap-1 ml-auto"
                        title="View / edit contributions"
                      >
                        <DollarSign className="h-3.5 w-3.5 opacity-60" />
                        {formatCurrency(person.contribution ?? 0)}
                      </button>
                    </td>

                    <td className="px-4 py-2 whitespace-nowrap">
                      {isEditing ? (
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => saveEdit(person.id)}
                            disabled={saving}
                            className="text-emerald-400 hover:text-emerald-300"
                            title="Save"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={cancelEdit}
                            disabled={saving}
                            title="Cancel"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => startEdit(person)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(person)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={contributionPersonId !== null}
        onClose={() => setContributionPersonId(null)}
        title={`Contributions - ${contributionPersonName}`}
        size="lg"
      >
        {contributionPersonId && (
          <ContributionsList
            personId={contributionPersonId}
            onChange={onContributionsChange}
          />
        )}
      </Modal>
    </>
  )
})

PeopleTable.displayName = 'PeopleTable'
