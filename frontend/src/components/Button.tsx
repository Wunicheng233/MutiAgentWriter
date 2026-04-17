import React from 'react'

type Variant = 'primary' | 'secondary' | 'tertiary' | 'ghost'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'default' | 'sm'
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'default',
  className = '',
  children,
  ...props
}) => {
  const baseClasses = 'rounded-full font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-sage/25 disabled:opacity-50 disabled:cursor-not-allowed'

  const variantClasses: Record<Variant, string> = {
    primary: 'bg-sage text-parchment hover:bg-sage/90',
    secondary: 'bg-transparent text-inkwell border border-border hover:bg-sage/5 hover:border-sage',
    tertiary: 'bg-transparent text-sage hover:bg-sage/5',
    ghost: 'bg-transparent text-secondary hover:bg-inkwell/5 hover:text-inkwell rounded-full p-2',
  }

  const sizeClasses = {
    default: 'px-6 py-3 text-base',
    sm: 'px-4 py-2 text-sm',
  }

  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  )
}

export default Button
