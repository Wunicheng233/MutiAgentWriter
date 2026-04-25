import { useState, useCallback } from 'react'
import { ToastContext } from './toastContext'
import type { Toast } from './toastContext'

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: Toast['type']) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  const getTypeClasses = (type: Toast['type']) => {
    switch (type) {
      case 'success': return 'bg-[var(--accent-primary)] text-white'
      case 'error': return 'bg-[var(--accent-warm)] text-white'
      case 'info': return 'bg-[var(--text-secondary)] text-white'
    }
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-[var(--shadow-elevated)] min-w-[200px] ${getTypeClasses(toast.type)}`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export default ToastProvider
