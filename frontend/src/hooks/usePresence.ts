import { useEffect, useRef, useState } from 'react'
import { wsBus } from './useWebSocket'

// Module-level cache of card-id → viewer count, populated from every
// presence:state we see. Lets the board surface "X is here" badges
// without each card opening its own subscription.
const cardViewerCounts = new Map<string, number>()
const cardListeners = new Set<() => void>()

function notifyCardListeners() {
  for (const fn of cardListeners) fn()
}

wsBus.subscribe((e) => {
  if (e.type !== 'presence:state') return
  if ((e.payload?.target_type as string) !== 'card') return
  const cid = e.payload?.target_id as string
  const users = (e.payload?.users as { user_id: string }[]) || []
  const seen = new Set<string>()
  let count = 0
  for (const u of users) {
    if (!seen.has(u.user_id)) {
      seen.add(u.user_id)
      count++
    }
  }
  if (count > 0) cardViewerCounts.set(cid, count)
  else cardViewerCounts.delete(cid)
  notifyCardListeners()
})

export function useCardViewerCount(cardId: string): number {
  const [, force] = useState(0)
  useEffect(() => {
    const fn = () => force((n) => n + 1)
    cardListeners.add(fn)
    return () => {
      cardListeners.delete(fn)
    }
  }, [])
  return cardViewerCounts.get(cardId) || 0
}

export interface PresenceUser {
  user_id: string
  display_name?: string
  avatar_url?: string
}

// Watches a single (target_type, target_id) — typically "card" + cardId.
// Returns the deduped (by user_id) list of currently-present users.
export function usePresence(targetType: string, targetId: string | null) {
  const [users, setUsers] = useState<PresenceUser[]>([])

  useEffect(() => {
    if (!targetId) {
      setUsers([])
      return
    }

    // Announce join + state-snapshot subscribe.
    wsBus.send({ type: 'presence:join', target_type: targetType, target_id: targetId })

    const off = wsBus.subscribe((e) => {
      if (
        e.type === 'presence:state' &&
        (e.payload?.target_type as string) === targetType &&
        (e.payload?.target_id as string) === targetId
      ) {
        const list = (e.payload?.users as PresenceUser[]) || []
        const seen = new Set<string>()
        setUsers(
          list.filter((u) => {
            if (seen.has(u.user_id)) return false
            seen.add(u.user_id)
            return true
          }),
        )
      }
    })

    return () => {
      wsBus.send({ type: 'presence:leave', target_type: targetType, target_id: targetId })
      off()
    }
  }, [targetType, targetId])

  return users
}

// Reads typing indicators for a (target_type, target_id). Returns the
// list of *other* users currently typing — debounced to 5s of silence.
export function useTypingIndicator(
  targetType: string,
  targetId: string | null,
  selfUserId?: string,
) {
  const [typers, setTypers] = useState<{ user_id: string; name: string }[]>([])
  const timersRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    if (!targetId) {
      setTypers([])
      return
    }
    const off = wsBus.subscribe((e) => {
      if (
        (e.payload?.target_type as string) !== targetType ||
        (e.payload?.target_id as string) !== targetId
      )
        return
      const userId = e.payload?.user_id as string
      const name = (e.payload?.display_name as string) || ''
      if (!userId || userId === selfUserId) return

      if (e.type === 'typing:start') {
        setTypers((prev) =>
          prev.find((t) => t.user_id === userId) ? prev : [...prev, { user_id: userId, name }],
        )
        // Auto-clear after 5s of no signal.
        const existing = timersRef.current.get(userId)
        if (existing) clearTimeout(existing)
        const t = window.setTimeout(() => {
          setTypers((prev) => prev.filter((tp) => tp.user_id !== userId))
          timersRef.current.delete(userId)
        }, 5000)
        timersRef.current.set(userId, t)
      } else if (e.type === 'typing:stop') {
        setTypers((prev) => prev.filter((tp) => tp.user_id !== userId))
        const existing = timersRef.current.get(userId)
        if (existing) clearTimeout(existing)
        timersRef.current.delete(userId)
      }
    })
    return () => {
      off()
      const timers = timersRef.current
      timers.forEach((id) => clearTimeout(id))
      timers.clear()
    }
  }, [targetType, targetId, selfUserId])

  return typers
}

// Sender side — call notify() on each keystroke; the hook debounces
// re-emits. Call stop() on submit or unmount.
export function useTypingNotifier(targetType: string, targetId: string | null) {
  const lastSentRef = useRef(0)
  const stopTimerRef = useRef<number | null>(null)

  const notify = () => {
    if (!targetId) return
    const now = Date.now()
    if (now - lastSentRef.current > 2500) {
      wsBus.send({ type: 'typing:start', target_type: targetType, target_id: targetId })
      lastSentRef.current = now
    }
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current)
    stopTimerRef.current = window.setTimeout(() => {
      wsBus.send({ type: 'typing:stop', target_type: targetType, target_id: targetId })
      lastSentRef.current = 0
    }, 4000)
  }

  const stop = () => {
    if (!targetId) return
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current)
    wsBus.send({ type: 'typing:stop', target_type: targetType, target_id: targetId })
    lastSentRef.current = 0
  }

  useEffect(() => {
    return () => {
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current)
    }
  }, [])

  return { notify, stop }
}
