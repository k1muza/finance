'use client'

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  sub?: string
}

export function StatCard({ label, value, icon, sub }: StatCardProps) {
  return (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 flex items-start gap-4">
      <div className="bg-cyan-500/10 rounded-lg p-3 text-cyan-400">{icon}</div>
      <div>
        <p className="text-sm text-slate-400">{label}</p>
        <p className="text-2xl font-bold text-slate-100 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </div>
    </div>
  )
}
