// Per-browser preferences for "where did I just look" and "what do I
// pin to the top." Stored in localStorage — works offline, no backend
// round-trip, no schema migrations. Per-user accuracy is good enough
// because each user's browser session is theirs.

import { create } from 'zustand'

const RECENTS_KEY = 'northstar.recentBoards.v1'
const FAVES_KEY = 'northstar.favoriteBoards.v1'
const MAX_RECENTS = 6

export interface RecentBoard {
  id: string
  name: string
  visitedAt: number
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function save<T>(key: string, val: T) {
  try {
    localStorage.setItem(key, JSON.stringify(val))
  } catch {
    /* quota or private mode — silently ignore */
  }
}

interface PrefsStore {
  recents: RecentBoard[]
  favorites: Set<string>
  recordVisit: (b: { id: string; name: string }) => void
  toggleFavorite: (id: string) => void
  isFavorite: (id: string) => boolean
}

export const useBoardPrefs = create<PrefsStore>((set, get) => ({
  recents: load<RecentBoard[]>(RECENTS_KEY, []),
  favorites: new Set(load<string[]>(FAVES_KEY, [])),

  recordVisit: ({ id, name }) =>
    set((s) => {
      const next = [
        { id, name, visitedAt: Date.now() },
        ...s.recents.filter((r) => r.id !== id),
      ].slice(0, MAX_RECENTS)
      save(RECENTS_KEY, next)
      return { recents: next }
    }),

  toggleFavorite: (id) =>
    set((s) => {
      const next = new Set(s.favorites)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      save(FAVES_KEY, Array.from(next))
      return { favorites: next }
    }),

  isFavorite: (id) => get().favorites.has(id),
}))
