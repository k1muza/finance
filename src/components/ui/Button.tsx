'use client'

import { cn } from '@/lib/utils/cn'
import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] border font-medium transition-[background-color,border-color,color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] disabled:opacity-50 disabled:cursor-not-allowed',
          {
            'bg-[var(--accent-solid)] text-[var(--accent-contrast)] [border-color:var(--button-primary-border)] shadow-[var(--shadow-button)] hover:bg-[var(--accent-solid-hover)]': variant === 'primary',
            'bg-[var(--button-secondary-bg)] text-[var(--text-primary)] [border-color:var(--border-strong)] shadow-[var(--shadow-soft)] hover:bg-[var(--button-secondary-hover)]': variant === 'secondary',
            'bg-transparent text-[var(--text-secondary)] border-transparent hover:bg-[var(--button-ghost-hover)] hover:text-[var(--text-primary)]': variant === 'ghost',
            'bg-red-600 text-white hover:bg-red-500': variant === 'danger',
          },
          {
            'px-2.5 py-1.5 text-xs': size === 'sm',
            'px-4 py-2 text-sm': size === 'md',
            'px-5 py-2.5 text-base': size === 'lg',
          },
          className
        )}
        {...props}
      >
        {loading ? (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        ) : null}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

export { Button }
