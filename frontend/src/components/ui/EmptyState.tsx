import type { LucideIcon } from 'lucide-react'
import { Star } from 'lucide-react'

interface Props {
  // Defaults to the Northstar mark — gives empty states a consistent
  // brand fingerprint. Override for a more specific cue when it helps
  // the user (an Inbox icon for "no notifications" etc.).
  icon?: LucideIcon
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  // "centered" fills the full container; "compact" is a tight inline
  // empty notice (used inside cards).
  size?: 'centered' | 'compact'
}

export default function EmptyState({
  icon: Icon = Star,
  title,
  description,
  action,
  size = 'centered',
}: Props) {
  const wrap =
    size === 'centered'
      ? 'flex h-full min-h-[320px] flex-col items-center justify-center gap-3 p-10 text-center'
      : 'flex flex-col items-center gap-2 p-6 text-center'

  return (
    <div className={wrap}>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-900/50">
        <Icon className="h-6 w-6" />
      </span>
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      {description && (
        <p className="max-w-sm text-sm text-gray-600 dark:text-gray-400">{description}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
