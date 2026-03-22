'use client'

import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Region, Department } from '@/types'

interface PeopleFiltersProps {
  search: string
  gender: string
  regionId: string
  departmentId: string
  regions: Region[]
  departments: Department[]
  onChange: (field: string, value: string) => void
}

export function PeopleFilters({ search, gender, regionId, departmentId, regions, departments, onChange }: PeopleFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <div className="flex-1 min-w-48">
        <Input
          placeholder="Search by name…"
          value={search}
          onChange={(e) => onChange('search', e.target.value)}
        />
      </div>
      <Select
        value={gender}
        onChange={(e) => onChange('gender', e.target.value)}
        placeholder="All genders"
        options={[
          { value: 'male', label: 'Male' },
          { value: 'female', label: 'Female' },
          { value: 'other', label: 'Other' },
        ]}
        className="w-36"
      />
      <Select
        value={regionId}
        onChange={(e) => onChange('regionId', e.target.value)}
        placeholder="All regions"
        options={regions.map((r) => ({ value: r.id, label: r.name }))}
        className="w-44"
      />
      <Select
        value={departmentId}
        onChange={(e) => onChange('departmentId', e.target.value)}
        placeholder="All departments"
        options={departments.map((d) => ({ value: d.id, label: d.name }))}
        className="w-44"
      />
    </div>
  )
}
