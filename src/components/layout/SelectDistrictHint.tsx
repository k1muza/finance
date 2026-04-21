'use client'

import { Landmark } from 'lucide-react'
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/Card'

interface SelectDistrictHintProps {
  title?: string
  description: string
}

export function SelectDistrictHint({
  title = 'Select a district',
  description,
}: SelectDistrictHintProps) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3">
        <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent-solid)]" />
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardContent>
    </Card>
  )
}
