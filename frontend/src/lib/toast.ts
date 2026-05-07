import { create } from 'zustand'

export type ToastVariant = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  variant: ToastVariant
  message: string
  // Optional inline action — typically "Undo" for destructive ops.
  action?: { label: string; onClick: () => void }
  durationMs: number
}

interface ToastStore {
  toasts: Toast[]
  push: (t: Omit<Toast, 'id' | 'durationMs'> & { durationMs?: number }) => string
  dismiss: (id: string) => void
}

let counter = 0
const nextID = () => `t-${Date.now()}-${counter++}`

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (t) => {
    const id = nextID()
    const durationMs = t.durationMs ?? (t.variant === 'error' ? 6000 : 3500)
    set((s) => ({ toasts: [...s.toasts, { ...t, id, durationMs }] }))
    return id
  },
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}))

// Module-level façade so non-React code (mutation onSuccess callbacks,
// axios interceptors) can fire toasts without threading hooks through.
function makeToaster(variant: ToastVariant) {
  return (
    message: string,
    opts?: { action?: Toast['action']; durationMs?: number },
  ) => useToastStore.getState().push({ variant, message, ...opts })
}

export const toast = {
  success: makeToaster('success'),
  error: makeToaster('error'),
  info: makeToaster('info'),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
}
