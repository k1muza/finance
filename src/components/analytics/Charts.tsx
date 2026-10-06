'use client'

import { useState, type ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { cn } from '@/lib/utils/cn'

// Lightweight HTML/CSS charts — enough for column and bar charts without a chart
// library. Marks carry the series colour; every bit of text uses text tokens.

export interface ChartSeries {
  key: string
  label: string
  /** CSS colour, normally a --viz-series-N token */
  color: string
  values: number[]
}

/** Round `max` up to a clean axis top and return evenly spaced ticks (0 first). */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1]
  const rough = max / count
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? 10 * magnitude
  const top = Math.ceil(max / step) * step
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
}

const compactNumber = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })

export function ChartCard({
  title,
  description,
  actions,
  children,
}: {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-3 pb-2">
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {actions}
      </CardHeader>
      <CardContent className="pt-2">{children}</CardContent>
    </Card>
  )
}

export function Legend({ series }: { series: Array<Pick<ChartSeries, 'key' | 'label' | 'color'>> }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)]">
      {series.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: s.color }} aria-hidden />
          {s.label}
        </span>
      ))}
    </div>
  )
}

/**
 * Vertical columns per category, one column per series, with a hover tooltip and an
 * optional table view. Legend appears for two or more series.
 */
export function ColumnChart({
  categories,
  categoryLabels,
  categoryTitles,
  series,
  formatValue,
  height = 220,
  showTable = false,
}: {
  categories: string[]
  /** Short axis labels, one per category */
  categoryLabels: string[]
  /** Longer labels for the tooltip and table */
  categoryTitles: string[]
  series: ChartSeries[]
  formatValue: (value: number) => string
  height?: number
  showTable?: boolean
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  const max = Math.max(0, ...series.flatMap((s) => s.values))
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1]

  if (showTable) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-[var(--text-tertiary)] [border-color:var(--border-subtle)]">
              <th className="py-2 pr-4 font-medium">Period</th>
              {series.map((s) => (
                <th key={s.key} className="py-2 pr-4 text-right font-medium">{s.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((category, i) => (
              <tr key={category} className="border-b last:border-0 [border-color:var(--border-subtle)]">
                <td className="py-1.5 pr-4 text-[var(--text-secondary)]">{categoryTitles[i]}</td>
                {series.map((s) => (
                  <td key={s.key} className="py-1.5 pr-4 text-right tabular-nums text-[var(--text-primary)]">
                    {formatValue(s.values[i])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {series.length > 1 && <Legend series={series} />}
      <div className="flex gap-2">
        {/* y-axis */}
        <div className="relative w-10 shrink-0 text-right text-[11px] tabular-nums text-[var(--text-muted)]" style={{ height }}>
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute right-0 -translate-y-1/2"
              style={{ bottom: `${(tick / top) * 100}%` }}
            >
              {compactNumber.format(tick)}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative" style={{ height }}>
            {/* gridlines */}
            {ticks.map((tick) => (
              <div
                key={tick}
                className="absolute inset-x-0 border-t [border-color:var(--border-subtle)]"
                style={{ bottom: `${(tick / top) * 100}%` }}
              />
            ))}

            <div className="absolute inset-0 flex">
              {categories.map((category, i) => (
                <div
                  key={category}
                  className={cn(
                    'relative flex flex-1 items-end justify-center gap-[2px] rounded-sm',
                    hovered === i && 'bg-[var(--button-ghost-hover)]'
                  )}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                >
                  {series.map((s) => (
                    <div
                      key={s.key}
                      className="w-full max-w-6 rounded-t-[4px]"
                      style={{
                        height: `${(s.values[i] / top) * 100}%`,
                        background: s.color,
                        minHeight: s.values[i] > 0 ? 2 : 0,
                      }}
                    />
                  ))}

                  {hovered === i && (
                    <div
                      role="tooltip"
                      className={cn(
                        'pointer-events-none absolute bottom-full z-10 mb-2 min-w-40 rounded-sm border bg-[var(--surface-elevated)] px-3 py-2 text-xs shadow-[var(--shadow-popover)] [border-color:var(--border-strong)]',
                        i < categories.length / 2 ? 'left-0' : 'right-0'
                      )}
                    >
                      <p className="mb-1 font-medium text-[var(--text-primary)]">{categoryTitles[i]}</p>
                      {series.map((s) => (
                        <p key={s.key} className="flex items-center justify-between gap-4 text-[var(--text-secondary)]">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-[2px]" style={{ background: s.color }} aria-hidden />
                            {s.label}
                          </span>
                          <span className="tabular-nums text-[var(--text-primary)]">{formatValue(s.values[i])}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* x-axis */}
          <div className="mt-1.5 flex text-[11px] text-[var(--text-muted)]">
            {categoryLabels.map((label, i) => (
              <span key={categories[i]} className="flex-1 truncate text-center">{label}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Horizontal bars with the value at each bar's tip. Single series, so no legend. */
export function BarList({
  rows,
  color,
  formatValue,
  emptyMessage = 'Nothing to show for this period.',
}: {
  rows: Array<{ key: string; label: string; amount: number }>
  color: string
  formatValue: (value: number) => string
  emptyMessage?: string
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-[var(--text-tertiary)]">{emptyMessage}</p>
  }

  const max = Math.max(...rows.map((r) => r.amount))
  const total = rows.reduce((sum, r) => sum + r.amount, 0)

  return (
    <ul className="space-y-2.5">
      {rows.map((row) => (
        <li
          key={row.key}
          className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 text-sm"
          title={`${row.label}: ${formatValue(row.amount)} (${total > 0 ? Math.round((row.amount / total) * 100) : 0}%)`}
        >
          <span className="truncate text-[var(--text-secondary)]">{row.label}</span>
          <span className="flex min-w-0 items-center gap-2">
            <span
              className="h-3 shrink-0 rounded-r-[4px]"
              style={{ width: `calc((100% - 6rem) * ${max > 0 ? row.amount / max : 0})`, background: color, minWidth: 2 }}
            />
            <span className="shrink-0 tabular-nums text-xs text-[var(--text-primary)]">{formatValue(row.amount)}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
