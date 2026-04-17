'use client'

import { cn } from '@/lib/utils/cn'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'teal' | 'green' | 'yellow' | 'red' | 'purple'
  className?: string
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        {
          'bg-[var(--surface-panel-muted)] text-[var(--text-secondary)] [border-color:var(--border-subtle)]': variant === 'default',
          'bg-[var(--accent-soft)] text-[var(--accent-solid-hover)] [border-color:var(--accent-border)]': variant === 'teal',
          'bg-green-500/20 text-green-400': variant === 'green',
          'bg-yellow-500/20 text-yellow-400': variant === 'yellow',
          'bg-red-500/20 text-red-400': variant === 'red',
          'bg-purple-500/20 text-purple-400': variant === 'purple',
        },
        className
      )}
    >
      {children}
    </span>
  )
}
