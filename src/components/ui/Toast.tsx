'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { useAppUiStore, type ToastPosition } from '@/stores/app-ui-store'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  type: ToastType
  message: string
}

interface ToastContextValue {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const POSITION_CLASSES: Record<ToastPosition, string> = {
  'top-left':      'top-4 left-4',
  'top-center':    'top-4 left-1/2 -translate-x-1/2',
  'top-right':     'top-4 right-4',
  'bottom-left':   'bottom-4 left-4',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  'bottom-right':  'bottom-4 right-4',
}

const ANIMATION_CLASSES: Record<ToastPosition, string> = {
  'top-left':      'slide-in-from-left',
  'top-center':    'slide-in-from-top',
  'top-right':     'slide-in-from-right',
  'bottom-left':   'slide-in-from-left',
  'bottom-center': 'slide-in-from-bottom',
  'bottom-right':  'slide-in-from-right',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const position = useAppUiStore((s) => s.toastPosition)

  const push = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  const dismiss = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id))

  return (
    <ToastContext.Provider
      value={{
        success: (msg) => push('success', msg),
        error: (msg) => push('error', msg),
        info: (msg) => push('info', msg),
      }}
    >
      {children}
      <div className={cn('fixed z-50 flex flex-col gap-2 w-80', POSITION_CLASSES[position])}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'animate-in flex items-start gap-3 rounded-[var(--radius-sm)] border px-4 py-3 text-sm shadow-[var(--shadow-card)] backdrop-blur-[var(--panel-blur)]',
              ANIMATION_CLASSES[position],
              {
                'bg-green-900/90 border-green-700 text-green-100': toast.type === 'success',
                'bg-red-900/90 border-red-700 text-red-100': toast.type === 'error',
                'bg-[var(--surface-elevated)] text-[var(--text-primary)] [border-color:var(--border-strong)]': toast.type === 'info',
              }
            )}
          >
            {toast.type === 'success' && <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
            {toast.type === 'info' && <Info className="h-4 w-4 mt-0.5 shrink-0" />}
            <p className="flex-1">{toast.message}</p>
            <button onClick={() => dismiss(toast.id)} className="shrink-0 opacity-70 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
