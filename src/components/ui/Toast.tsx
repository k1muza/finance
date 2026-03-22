'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'

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

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

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
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'flex items-start gap-3 rounded-lg px-4 py-3 shadow-lg border text-sm animate-in slide-in-from-right',
              {
                'bg-green-900/90 border-green-700 text-green-100': toast.type === 'success',
                'bg-red-900/90 border-red-700 text-red-100': toast.type === 'error',
                'bg-slate-800 border-slate-600 text-slate-100': toast.type === 'info',
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
