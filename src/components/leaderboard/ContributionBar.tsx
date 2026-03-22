'use client'

interface ContributionBarProps {
  value: number
  max: number
}

export function ContributionBar({ value, max }: ContributionBarProps) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
      <div
        className="h-full bg-cyan-500 rounded-full transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
