'use client'

import { cn } from '@/lib/utils/cn'
import { SelectHTMLAttributes, forwardRef } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, options, placeholder, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-[var(--text-secondary)]">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={id}
          className={cn(
            'w-full rounded-[var(--radius-md)] border bg-[var(--field-bg)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-[var(--field-shadow)] transition-[background-color,border-color,box-shadow,color] outline-none [border-color:var(--field-border)] hover:[border-color:var(--field-border-hover)] focus:ring-2 focus:ring-[var(--accent-ring)] focus:[border-color:var(--accent-border)]',
            error && 'border-red-500',
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" className="text-[var(--text-muted)]">
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    )
  }
)
Select.displayName = 'Select'

export { Select }
