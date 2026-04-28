import { useState, useCallback, useEffect } from 'react'
import { Alert } from '../Alert/Alert'
import { ToastContext, type Toast, type ToastType } from './toastContext'

export type ToastVariant = 'success' | 'warning' | 'error' | 'info'

export interface ToastProps {
  message: string
  open: boolean
  onClose: () => void
  duration?: number
  variant?: ToastVariant
}

export const Toast: React.FC<ToastProps> = ({
  message,
  open,
  onClose,
  duration = 3000,
  variant = 'info',
}) => {
  useEffect(() => {
    if (open && duration > 0) {
      const timer = setTimeout(() => {
        onClose()
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [open, duration, onClose])

  if (!open) {
    return null
  }

  return (
    <Alert
      variant={variant}
      closable
      onClose={onClose}
    >
      {message}
    </Alert>
  )
}

Toast.displayName = 'Toast'

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 min-w-[280px]">
        {toasts.map(toast => (
          <Alert
            key={toast.id}
            variant={toast.type === 'error' ? 'error' : toast.type}
            closable
          >
            {toast.message}
          </Alert>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

ToastProvider.displayName = 'ToastProvider'
