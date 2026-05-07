import { useEffect } from 'react'
import { create } from 'zustand'
import { AlertTriangle, Star } from 'lucide-react'

interface ConfirmOptions {
  title: string
  body?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  // Renders the primary button in destructive (red) styling.
  danger?: boolean
}

interface PendingPrompt extends ConfirmOptions {
  resolve: (ok: boolean) => void
}

interface ConfirmStore {
  prompt: PendingPrompt | null
  ask: (opts: ConfirmOptions) => Promise<boolean>
  close: (ok: boolean) => void
}

const useConfirmStore = create<ConfirmStore>((set, get) => ({
  prompt: null,
  ask: (opts) =>
    new Promise<boolean>((resolve) => {
      // If a previous prompt is still on screen (shouldn't normally happen
      // but be safe), resolve it as cancelled before queuing the new one.
      const existing = get().prompt
      if (existing) existing.resolve(false)
      set({ prompt: { ...opts, resolve } })
    }),
  close: (ok) => {
    const p = get().prompt
    if (p) p.resolve(ok)
    set({ prompt: null })
  },
}))

// Module-level façade so non-hook code can prompt too. Named
// confirmDialog (not `confirm`) to avoid shadowing the global.
//   const ok = await confirmDialog({ title: 'Delete card?', danger: true })
export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return useConfirmStore.getState().ask(opts)
}

// Hook variant for components that want to memoize a confirm with the
// same options inside an effect. Most callers should just use confirm()
// at the call site.
export function useConfirm() {
  return useConfirmStore((s) => s.ask)
}

export default function ConfirmDialogHost() {
  const prompt = useConfirmStore((s) => s.prompt)
  const close = useConfirmStore((s) => s.close)

  useEffect(() => {
    if (!prompt) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false)
      if (e.key === 'Enter') close(true)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [prompt, close])

  if (!prompt) return null

  const { title, body, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger } = prompt

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onClick={() => close(false)}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start gap-3">
          {danger ? (
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300">
              <AlertTriangle className="h-5 w-5" />
            </span>
          ) : (
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
              <Star className="h-5 w-5" />
            </span>
          )}
          <div className="flex-1">
            <h2 id="confirm-title" className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </h2>
            {body && (
              <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">{body}</div>
            )}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            autoFocus
            onClick={() => close(false)}
            className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => close(true)}
            className={
              danger
                ? 'rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700'
                : 'rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700'
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
