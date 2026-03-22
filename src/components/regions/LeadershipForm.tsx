'use client'

import { usePeople } from '@/hooks/usePeople'
import { PersonPicker } from '@/components/ui/PersonPicker'

interface LeadershipFormProps {
  chairperson: string
  vice_chairperson: string
  secretary: string
  vice_secretary: string
  onChange: (field: string, value: string) => void
}

export function LeadershipForm({ chairperson, vice_chairperson, secretary, vice_secretary, onChange }: LeadershipFormProps) {
  const { data: people } = usePeople()

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <PersonPicker
        label="Chairperson"
        value={chairperson}
        onChange={(name) => onChange('chairperson', name)}
        people={people}
        required
      />
      <PersonPicker
        label="Vice Chairperson"
        value={vice_chairperson}
        onChange={(name) => onChange('vice_chairperson', name)}
        people={people}
      />
      <PersonPicker
        label="Secretary"
        value={secretary}
        onChange={(name) => onChange('secretary', name)}
        people={people}
      />
      <PersonPicker
        label="Vice Secretary"
        value={vice_secretary}
        onChange={(name) => onChange('vice_secretary', name)}
        people={people}
      />
    </div>
  )
}
