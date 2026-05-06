import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useLayoutStore } from '../store/useLayoutStore'

const ChatIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
)

export const FloatingToggleButton: React.FC = () => {
  const { rightPanelOpen, setRightPanelOpen } = useLayoutStore(
    useShallow((state) => ({
      rightPanelOpen: state.rightPanelOpen,
      setRightPanelOpen: state.setRightPanelOpen,
    }))
  )

  return (
    <button
      data-testid="floating-toggle-button"
      onClick={() => setRightPanelOpen(true)}
      aria-label="Open AI Assistant"
      className={`non-essential-ui fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-[var(--accent-primary)] text-white shadow-lg hover:shadow-xl flex items-center justify-center transition-all duration-200 ease-out hover:scale-105 ${
        rightPanelOpen ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
      }`}
      title="Open AI Assistant"
    >
      <ChatIcon />
    </button>
  )
}

export default FloatingToggleButton
