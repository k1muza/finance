'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface PageHeaderProps {
  title: ReactNode
  description?: string
  actions?: ReactNode
  className?: string
  size?: 'md' | 'lg'
}

export function PageHeader({
  title,
  description,
  actions,
  className,
  size = 'lg',
}: PageHeaderProps) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-4', className)}>
      <div>
        <h1
          className={cn(
            'font-bold text-[var(--text-primary)]',
            size === 'lg' ? 'text-2xl' : 'text-xl',
          )}
        >
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">{description}</p>
        )}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  )
}
