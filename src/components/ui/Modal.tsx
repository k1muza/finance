'use client'

import { useEffect, ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[var(--surface-overlay)] backdrop-blur-[var(--overlay-blur)]"
        onClick={onClose}
      />
      <div
        className={cn(
          'relative flex max-h-[90vh] w-full flex-col rounded-[var(--radius-xl)] border bg-[var(--surface-elevated)] shadow-[var(--shadow-popover)] backdrop-blur-[var(--panel-blur)] [border-color:var(--border-strong)]',
          {
            'max-w-sm': size === 'sm',
            'max-w-lg': size === 'md',
            'max-w-2xl': size === 'lg',
            'max-w-4xl': size === 'xl',
          }
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b px-6 py-4 [border-color:var(--border-subtle)]">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">{title}</h2>
          <button onClick={onClose} className="text-[var(--text-tertiary)] transition hover:text-[var(--text-primary)]">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 text-[var(--text-secondary)]">{children}</div>
      </div>
    </div>
  )
}
