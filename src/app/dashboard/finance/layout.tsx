'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils/cn'

const tabs = [
  { href: '/dashboard/finance/expenditure', label: 'Expenditure' },
  { href: '/dashboard/finance/income', label: 'Income' },
  { href: '/dashboard/finance/reports', label: 'Reports' },
]

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-slate-700 bg-slate-900/50 px-6">
        <nav className="flex gap-1 -mb-px">
          {tabs.map(({ href, label }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                  active
                    ? 'border-cyan-500 text-cyan-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                )}
              >
                {label}
              </Link>
            )
          })}
        </nav>
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  )
}
