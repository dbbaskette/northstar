import { useEffect } from 'react'
import { CheckCircle2, AlertCircle, Info, X, Star } from 'lucide-react'
import { useToastStore, type Toast } from '@/lib/toast'

export default function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  )
}

const VARIANT_STYLES: Record<Toast['variant'], { wrap: string; icon: React.ReactNode }> = {
  success: {
    wrap: 'border-emerald-200 bg-white text-gray-900 dark:border-emerald-700 dark:bg-gray-800 dark:text-gray-100',
    // The Northstar mark sits inside the success badge — small bit of
    // brand reinforcement on the moment of "it worked".
    icon: (
      <span className="relative flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
        <CheckCircle2 className="h-4 w-4" />
        <Star className="absolute -right-0.5 -top-0.5 h-3 w-3 fill-amber-400 stroke-amber-500" />
      </span>
    ),
  },
  error: {
    wrap: 'border-red-200 bg-white text-gray-900 dark:border-red-800 dark:bg-gray-800 dark:text-gray-100',
    icon: (
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300">
        <AlertCircle className="h-4 w-4" />
      </span>
    ),
  },
  info: {
    wrap: 'border-gray-200 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100',
    icon: (
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
        <Info className="h-4 w-4" />
      </span>
    ),
  },
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, toast.durationMs)
    return () => window.clearTimeout(timer)
    // onDismiss reference is stable enough (zustand getState wrapper) — no need to retrigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id])

  const styles = VARIANT_STYLES[toast.variant]
  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-3 rounded-lg border p-3 text-sm shadow-lg transition ${styles.wrap}`}
    >
      {styles.icon}
      <div className="flex-1 leading-5">{toast.message}</div>
      {toast.action && (
        <button
          onClick={() => {
            toast.action?.onClick()
            onDismiss()
          }}
          className="shrink-0 rounded px-2 py-0.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-900/30"
        >
          {toast.action.label}
        </button>
      )}
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
