'use client'

import { Person, PersonRoleType } from '@/types'
import { PersonPicker } from '@/components/ui/PersonPicker'

interface LeadershipFormProps {
  chairperson_id: string | null
  vice_chairperson_id: string | null
  secretary_id: string | null
  vice_secretary_id: string | null
  onChange: (role: PersonRoleType, personId: string | null) => void
  /** People pre-filtered to valid candidates for this entity */
  people: Person[]
}

export function LeadershipForm({
  chairperson_id,
  vice_chairperson_id,
  secretary_id,
  vice_secretary_id,
  onChange,
  people,
}: LeadershipFormProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <PersonPicker
        label="Chairperson"
        value={chairperson_id ?? ''}
        onChange={(id) => onChange('chairperson', id || null)}
        people={people}
        valueMode="id"
        required
      />
      <PersonPicker
        label="Vice Chairperson"
        value={vice_chairperson_id ?? ''}
        onChange={(id) => onChange('vice_chairperson', id || null)}
        people={people}
        valueMode="id"
      />
      <PersonPicker
        label="Secretary"
        value={secretary_id ?? ''}
        onChange={(id) => onChange('secretary', id || null)}
        people={people}
        valueMode="id"
      />
      <PersonPicker
        label="Vice Secretary"
        value={vice_secretary_id ?? ''}
        onChange={(id) => onChange('vice_secretary', id || null)}
        people={people}
        valueMode="id"
      />
    </div>
  )
}
