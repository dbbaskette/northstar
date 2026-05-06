import { Sun, Moon, Monitor } from 'lucide-react'
import { useThemeStore, type ThemePreference } from '@/stores/themeStore'

const OPTIONS: { value: ThemePreference; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'dark', icon: Moon, label: 'Dark' },
  { value: 'system', icon: Monitor, label: 'System' },
]

export default function ThemeToggle() {
  const preference = useThemeStore((s) => s.preference)
  const setPreference = useThemeStore((s) => s.setPreference)

  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800">
      {OPTIONS.map((opt) => {
        const Icon = opt.icon
        const active = preference === opt.value
        return (
          <button
            key={opt.value}
            onClick={() => setPreference(opt.value)}
            className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
              active
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-gray-100'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
            title={opt.label}
            aria-label={`Theme: ${opt.label}`}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        )
      })}
    </div>
  )
}
