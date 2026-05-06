interface Props {
  user: {
    id: string
    display_name?: string
    avatar_url?: { String: string; Valid: boolean } | string | null
  }
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const SIZES: Record<NonNullable<Props['size']>, string> = {
  sm: 'h-6 w-6 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-10 w-10 text-base',
  xl: 'h-20 w-20 text-2xl',
}

const COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
  'bg-violet-500', 'bg-cyan-500', 'bg-pink-500', 'bg-orange-500',
  'bg-teal-500', 'bg-indigo-500',
]

function flatString(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'string') return v
  if (typeof v === 'object' && 'Valid' in v && (v as { Valid: boolean }).Valid) {
    return (v as { String?: string }).String ?? null
  }
  return null
}

function colorFor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return COLORS[hash % COLORS.length]!
}

export default function Avatar({ user, size = 'md' }: Props) {
  const url = flatString(user.avatar_url)
  const initials = (user.display_name || '?')
    .split(/\s+/)
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase()

  if (url) {
    return (
      <img
        src={url}
        alt={user.display_name || 'avatar'}
        className={`flex-shrink-0 rounded-full object-cover ${SIZES[size]}`}
      />
    )
  }

  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center rounded-full font-bold text-white ${SIZES[size]} ${colorFor(user.id)}`}
      title={user.display_name}
    >
      {initials}
    </div>
  )
}
