import { useEffect } from 'react'

const SUFFIX = 'Northstar'

// Set the browser tab title for the lifetime of the calling component.
// Pass undefined or '' to fall back to the bare app name.
// On unmount the title resets to the suffix so leftover state from a
// page you navigated away from doesn't linger.
export function useDocumentTitle(title?: string | null) {
  useEffect(() => {
    const next = title && title.trim() ? `${title.trim()} · ${SUFFIX}` : SUFFIX
    const previous = document.title
    document.title = next
    return () => {
      document.title = previous
    }
  }, [title])
}
