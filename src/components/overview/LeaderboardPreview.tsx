'use client'

import Link from 'next/link'
import { LeaderboardEntry } from '@/types'
import { formatCurrency } from '@/lib/utils/formatCurrency'
import { Trophy, ArrowRight } from 'lucide-react'

const rankColors = ['text-yellow-400', 'text-slate-300', 'text-amber-600']

export function LeaderboardPreview({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-400" />
          <h2 className="font-semibold text-slate-100">Top Contributors</h2>
        </div>
        <Link
          href="/dashboard/leaderboard"
          className="flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300 transition"
        >
          View all <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {entries.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-6">No contributors yet</p>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-center gap-3">
              <span
                className={`w-7 text-center font-bold text-sm ${rankColors[entry.rank - 1] ?? 'text-slate-500'}`}
              >
                #{entry.rank}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-100 truncate">{entry.name}</p>
                <p className="text-xs text-slate-500 truncate">
                  {entry.department_name ?? '—'} · {entry.region_name ?? '—'}
                </p>
              </div>
              <span className="text-sm font-semibold text-cyan-400">
                {formatCurrency(entry.contribution)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
