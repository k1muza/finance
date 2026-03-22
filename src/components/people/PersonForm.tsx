'use client'

import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Region, Department } from '@/types'

export interface PersonFormValues {
  name: string
  phone: string
  gender: string
  region_id: string
  department_id: string
}

interface PersonFormProps {
  values: PersonFormValues
  errors: Record<string, string>
  regions: Region[]
  departments: Department[]
  onChange: (field: keyof PersonFormValues, value: string) => void
}

export function PersonForm({ values, errors, regions, departments, onChange }: PersonFormProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2">
        <Input
          label="Full Name *"
          value={values.name}
          onChange={(e) => onChange('name', e.target.value)}
          error={errors.name}
          placeholder="John Doe"
        />
      </div>
      <Input
        label="Phone Number"
        value={values.phone}
        onChange={(e) => onChange('phone', e.target.value)}
        placeholder="+263 77 000 0000"
        type="tel"
      />
      <Select
        label="Gender"
        value={values.gender}
        onChange={(e) => onChange('gender', e.target.value)}
        placeholder="Select gender"
        options={[
          { value: 'male', label: 'Male' },
          { value: 'female', label: 'Female' },
          { value: 'other', label: 'Other' },
        ]}
      />
      <Select
        label="Region"
        value={values.region_id}
        onChange={(e) => onChange('region_id', e.target.value)}
        placeholder="Select region"
        options={regions.map((r) => ({ value: r.id, label: r.name }))}
      />
      <Select
        label="Department"
        value={values.department_id}
        onChange={(e) => onChange('department_id', e.target.value)}
        placeholder="Select department"
        options={departments.map((d) => ({ value: d.id, label: d.name }))}
      />
    </div>
  )
}
