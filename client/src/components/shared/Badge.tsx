import type { ReactNode } from 'react'

interface BadgeProps {
  children: ReactNode
  variant?: 'neutral' | 'easy' | 'medium' | 'hard' | 'rank-gold' | 'rank-silver' | 'rank-bronze'
  className?: string
}

export function Badge({ children, variant = 'neutral', className = '' }: BadgeProps) {
  const variantStyles = {
    neutral: 'bg-gray-100 text-gray-700 border-gray-200',
    easy: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-medium',
    medium: 'bg-amber-50 text-amber-700 border-amber-200 font-medium',
    hard: 'bg-rose-50 text-rose-700 border-rose-200 font-medium',
    'rank-gold': 'bg-amber-100 text-amber-900 border-amber-300 font-bold',
    'rank-silver': 'bg-slate-200 text-slate-800 border-slate-300 font-bold',
    'rank-bronze': 'bg-orange-100 text-orange-900 border-orange-300 font-bold',
  }[variant]

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${variantStyles} ${className}`}
    >
      {children}
    </span>
  )
}
