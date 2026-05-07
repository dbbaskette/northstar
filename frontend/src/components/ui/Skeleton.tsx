import type { CSSProperties } from 'react'

interface Props {
  className?: string
  style?: CSSProperties
  rounded?: 'sm' | 'md' | 'lg' | 'full'
}

const ROUNDED: Record<NonNullable<Props['rounded']>, string> = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
}

// Animated shimmer block. Tailwind's animate-pulse is enough for the
// effect we want — no separate keyframes needed.
export default function Skeleton({ className = '', style, rounded = 'md' }: Props) {
  return (
    <div
      aria-hidden
      style={style}
      className={`animate-pulse bg-gray-200/80 dark:bg-gray-700 ${ROUNDED[rounded]} ${className}`}
    />
  )
}
