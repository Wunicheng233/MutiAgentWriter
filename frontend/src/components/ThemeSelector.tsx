import React from 'react'
import { useThemeStore } from '../store/useThemeStore'
import type { Theme } from '../store/useThemeStore'

const themeOptions: { key: Theme; label: string; description: string }[] = [
  { key: 'parchment', label: 'Warm Parchment', description: 'Soft, paper-like, warm and comfortable for long writing sessions' },
  { key: 'clean-light', label: 'Clean Light', description: 'Bright, modern, crisp white background for clarity' },
  { key: 'deep-dark', label: 'Deep Dark', description: 'Dark, eye-friendly, perfect for night writing' },
]

export const ThemeSelector: React.FC = () => {
  const { theme, setTheme } = useThemeStore()

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-[var(--text-primary)]">Theme</h3>
      <div className="grid gap-3">
        {themeOptions.map((option) => (
          <button
            key={option.key}
            data-testid={`theme-${option.key}`}
            onClick={() => setTheme(option.key)}
            className={`w-full text-left p-4 rounded-lg border transition-all duration-150 hover:shadow-sm ${
              theme === option.key
                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                : 'border-[var(--border-default)] hover:border-[var(--border-strong)]'
            }`}
          >
            <div className={`font-medium ${theme === option.key ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'}`}>{option.label}</div>
            <div className={`text-sm mt-1 ${theme === option.key ? 'text-[var(--accent-primary)]/70' : 'text-[var(--text-secondary)]'}`}>{option.description}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default ThemeSelector
