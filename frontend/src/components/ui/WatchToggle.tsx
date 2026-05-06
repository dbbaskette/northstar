import { Eye, EyeOff } from 'lucide-react'
import { useIsWatching, useToggleWatch, type WatchTargetType } from '@/api/watchers'

interface Props {
  targetType: WatchTargetType
  targetID: string
  className?: string
  label?: boolean
}

export default function WatchToggle({ targetType, targetID, className, label }: Props) {
  const { data: watching } = useIsWatching(targetType, targetID)
  const toggle = useToggleWatch(targetType, targetID)

  return (
    <button
      onClick={() => toggle.mutate(!watching)}
      className={
        className ||
        `flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
          watching
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
        }`
      }
      title={watching ? 'Stop watching' : 'Watch for updates'}
    >
      {watching ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
      {label && (watching ? 'Watching' : 'Watch')}
    </button>
  )
}
