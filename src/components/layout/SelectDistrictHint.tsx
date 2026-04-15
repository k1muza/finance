'use client'

import { Landmark } from 'lucide-react'

interface SelectDistrictHintProps {
  title?: string
  description: string
}

export function SelectDistrictHint({
  title = 'Select a district',
  description,
}: SelectDistrictHintProps) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex items-start gap-3">
      <Landmark className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
      <div>
        <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
        <p className="text-sm text-slate-400 mt-1">{description}</p>
      </div>
    </div>
  )
}
