'use client'

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  sub?: string
}

export function StatCard({ label, value, icon, sub }: StatCardProps) {
  return (
    <div className="flex items-start gap-4 rounded-[var(--radius-lg)] border bg-[var(--surface-panel)] p-5 shadow-[var(--shadow-card)] [border-color:var(--border-strong)]">
      <div className="rounded-[calc(var(--radius-md)-2px)] bg-[var(--accent-soft)] p-3 text-[var(--accent-solid-hover)]">
        {icon}
      </div>
      <div>
        <p className="text-sm text-[var(--text-tertiary)]">{label}</p>
        <p className="mt-0.5 text-2xl font-bold text-[var(--text-primary)]">{value}</p>
        {sub && <p className="mt-1 text-xs text-[var(--text-muted)]">{sub}</p>}
      </div>
    </div>
  )
}
