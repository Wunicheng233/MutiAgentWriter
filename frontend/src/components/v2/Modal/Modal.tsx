import React, { forwardRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'

export interface ModalProps {
  isOpen: boolean
  onClose?: () => void
  size?: ModalSize
  showCloseButton?: boolean
  closeOnBackdropClick?: boolean
  closeOnEsc?: boolean
  children: React.ReactNode
  className?: string
}

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-full mx-4',
}

export const Modal = forwardRef<HTMLDivElement, ModalProps>(
  (
    {
      isOpen,
      onClose,
      size = 'md',
      showCloseButton = true,
      closeOnBackdropClick = true,
      closeOnEsc = true,
      children,
      className = '',
    },
    ref
  ) => {
    const handleBackdropClick = useCallback(() => {
      if (closeOnBackdropClick && onClose) {
        onClose()
      }
    }, [closeOnBackdropClick, onClose])

    const handleContentClick = (e: React.MouseEvent) => {
      e.stopPropagation()
    }

    // Handle Escape key
    useEffect(() => {
      if (!isOpen || !closeOnEsc) return

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && onClose) {
          onClose()
        }
      }

      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, closeOnEsc, onClose])

    // Body scroll lock
    useEffect(() => {
      if (isOpen) {
        document.body.style.overflow = 'hidden'
      } else {
        document.body.style.overflow = ''
      }
      return () => {
        document.body.style.overflow = ''
      }
    }, [isOpen])

    // Focus trap
    useEffect(() => {
      if (!isOpen) return

      const focusableElements = document.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      const firstFocusable = focusableElements[0] as HTMLElement
      if (firstFocusable) {
        setTimeout(() => firstFocusable.focus(), 10)
      }
    }, [isOpen])

    if (!isOpen) return null

    const modalContent = (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        data-testid="modal-backdrop"
        onClick={handleBackdropClick}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black bg-opacity-50 transition-opacity duration-[var(--duration-normal)] ease-[var(--ease-out)]" />

        {/* Modal Panel */}
        <div
          className={`relative w-full ${sizeClasses[size]} mx-4 transform transition-all duration-[var(--duration-normal)] ease-[var(--ease-out)]`}
        >
          <div
            ref={ref}
            data-testid="modal-content"
            className={`relative bg-[var(--bg-secondary)] rounded-[var(--radius-lg)] shadow-[var(--shadow-xl)] ${className}`.trim()}
            onClick={handleContentClick}
          >
            {showCloseButton && (
              <button
                data-testid="modal-close-button"
                onClick={onClose}
                className="absolute top-4 right-4 p-1 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors duration-[var(--duration-fast)]"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            {children}
          </div>
        </div>
      </div>
    )

    // Use portal if document is available
    if (typeof document !== 'undefined') {
      return createPortal(modalContent, document.body)
    }
    return modalContent
  }
)

Modal.displayName = 'Modal'

// ModalHeader Component
export interface ModalHeaderProps {
  children: React.ReactNode
  className?: string
}

export const ModalHeader: React.FC<ModalHeaderProps> = ({ children, className = '' }) => {
  return (
    <div className={`px-6 py-4 border-b border-[var(--border-default)] ${className}`.trim()}>
      <h3 className="text-lg font-semibold text-[var(--text-primary)]">{children}</h3>
    </div>
  )
}

// ModalContent Component
export interface ModalContentProps {
  children: React.ReactNode
  className?: string
}

export const ModalContent: React.FC<ModalContentProps> = ({ children, className = '' }) => {
  return (
    <div className={`px-6 py-4 text-[var(--text-body)] ${className}`.trim()}>
      {children}
    </div>
  )
}

// ModalFooter Component
export interface ModalFooterProps {
  children: React.ReactNode
  className?: string
}

export const ModalFooter: React.FC<ModalFooterProps> = ({ children, className = '' }) => {
  return (
    <div className={`px-6 py-4 border-t border-[var(--border-default)] flex items-center justify-end gap-3 ${className}`.trim()}>
      {children}
    </div>
  )
}
