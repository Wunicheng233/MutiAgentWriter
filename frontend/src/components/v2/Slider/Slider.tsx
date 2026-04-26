import React, { useState } from 'react'

export interface SliderProps {
  value?: number
  defaultValue?: number
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  onChange?: (value: number) => void
  label?: string
  showValue?: boolean
  className?: string
}

export const Slider: React.FC<SliderProps> = ({
  value: controlledValue,
  defaultValue = 50,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  onChange,
  label,
  showValue = false,
  className = '',
}) => {
  const isControlled = controlledValue !== undefined
  const [internalValue, setInternalValue] = useState(defaultValue)
  const value = isControlled ? controlledValue : internalValue

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value)
    if (!isControlled) {
      setInternalValue(newValue)
    }
    onChange?.(newValue)
  }

  const percentage = ((value - min) / (max - min)) * 100

  return (
    <div className={`flex flex-col gap-2 ${className}`.trim()}>
      {(label || showValue) && (
        <div className="flex justify-between items-center">
          {label && <span className="text-sm font-medium text-[var(--text-primary)]">{label}</span>}
          {showValue && <span className="text-sm text-[var(--text-secondary)]">{value}</span>}
        </div>
      )}
      <div className="relative flex items-center w-full h-5">
        <div className="absolute w-full h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
          <div
            className="absolute h-full bg-[var(--accent-primary)] rounded-full transition-all duration-150"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={handleChange}
          className="absolute w-full h-4 opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
        <div
          className={`absolute w-4 h-4 bg-[var(--accent-primary)] rounded-full shadow-md transform -translate-x-1/2 transition-all duration-150 pointer-events-none ${
            disabled ? 'opacity-50' : 'hover:scale-125'
          }`}
          style={{ left: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

Slider.displayName = 'Slider'
