import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { create } from 'zustand'
import {
  Search,
  LayoutGrid,
  Inbox,
  ShieldCheck,
  UserCog,
  Plug,
  Lock,
  User,
  Star,
  Clock,
  CornerDownLeft,
} from 'lucide-react'
import { useMyBoards } from '@/api/boards'
import { useSearch } from '@/api/search'
import { useMe } from '@/api/users'
import { useBoardPrefs } from '@/lib/boardPrefs'

// Open/close via a zustand store so anywhere in the app can summon
// the palette without prop-drilling. Cmd-K is wired globally at the
// App root.
interface PaletteStore {
  open: boolean
  setOpen: (v: boolean) => void
  toggle: () => void
}
export const useCommandPalette = create<PaletteStore>((set, get) => ({
  open: false,
  setOpen: (v) => set({ open: v }),
  toggle: () => set({ open: !get().open }),
}))

type Section = 'recent' | 'nav' | 'board' | 'card'

interface Item {
  id: string
  section: Section
  label: string
  hint?: string
  icon: React.ReactNode
  onPick: () => void
}

const SECTION_TITLE: Record<Section, string> = {
  recent: 'Recent',
  nav: 'Go to',
  board: 'Boards',
  card: 'Cards',
}

export default function CommandPalette() {
  const open = useCommandPalette((s) => s.open)
  const setOpen = useCommandPalette((s) => s.setOpen)
  const navigate = useNavigate()
  const { data: me } = useMe()
  const { data: boards = [] } = useMyBoards()
  const recents = useBoardPrefs((s) => s.recents)
  const favorites = useBoardPrefs((s) => s.favorites)

  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Search the card index only when the user has typed something
  // (2+ chars). Sub-2-char queries match boards/navigation only.
  const { data: cardSearch } = useSearch(query.length >= 2 ? query : '')

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase()
    const matches = (s: string) => !q || s.toLowerCase().includes(q)

    const out: Item[] = []

    // 1. Recents (only when query is empty — once user types, fold them into the boards list)
    if (!q) {
      for (const r of recents) {
        out.push({
          id: 'r:' + r.id,
          section: 'recent',
          label: r.name,
          icon: <Clock className="h-4 w-4 text-gray-400" />,
          onPick: () => navigate(`/boards/${r.id}`),
        })
      }
    }

    // 2. Navigation
    const nav: Array<{ to: string; label: string; icon: React.ReactNode; adminOnly?: boolean }> = [
      { to: '/my-work', label: 'My Work', icon: <Inbox className="h-4 w-4 text-gray-500" /> },
      { to: '/dashboard', label: 'Dashboard', icon: <LayoutGrid className="h-4 w-4 text-gray-500" /> },
      { to: '/profile', label: 'Profile', icon: <User className="h-4 w-4 text-gray-500" /> },
      { to: '/security', label: 'Security & sessions', icon: <Lock className="h-4 w-4 text-gray-500" /> },
      { to: '/admin/users', label: 'Admin · Users', icon: <UserCog className="h-4 w-4 text-gray-500" />, adminOnly: true },
      { to: '/admin/audit-log', label: 'Admin · Audit log', icon: <ShieldCheck className="h-4 w-4 text-gray-500" />, adminOnly: true },
      { to: '/admin/plugins', label: 'Admin · Plugins', icon: <Plug className="h-4 w-4 text-gray-500" />, adminOnly: true },
    ]
    for (const n of nav) {
      if (n.adminOnly && me?.role !== 'admin') continue
      if (!matches(n.label)) continue
      out.push({
        id: 'n:' + n.to,
        section: 'nav',
        label: n.label,
        icon: n.icon,
        onPick: () => navigate(n.to),
      })
    }

    // 3. Boards — favorites first, then the rest. Filter by query.
    const ranked = [...boards].sort((a, b) => {
      const af = favorites.has(a.id) ? 0 : 1
      const bf = favorites.has(b.id) ? 0 : 1
      if (af !== bf) return af - bf
      return a.name.localeCompare(b.name)
    })
    for (const b of ranked) {
      if (!matches(b.name) && !matches(b.team_name)) continue
      out.push({
        id: 'b:' + b.id,
        section: 'board',
        label: b.name,
        hint: b.team_name,
        icon: favorites.has(b.id) ? (
          <Star className="h-4 w-4 fill-amber-400 stroke-amber-500" />
        ) : (
          <LayoutGrid className="h-4 w-4 text-gray-400" />
        ),
        onPick: () => navigate(`/boards/${b.id}`),
      })
      if (out.filter((x) => x.section === 'board').length >= 8) break
    }

    // 4. Cards (only when search returned hits)
    if (q.length >= 2 && cardSearch?.results) {
      for (const r of cardSearch.results.slice(0, 6)) {
        out.push({
          id: 'c:' + r.card_id,
          section: 'card',
          label: r.card_title,
          hint: `${r.board_name} → ${r.list_name}`,
          icon: <Search className="h-4 w-4 text-gray-400" />,
          onPick: () => navigate(`/boards/${r.board_id}?card=${r.card_id}`),
        })
      }
    }

    return out
  }, [query, boards, recents, favorites, me, cardSearch, navigate])

  // Reset cursor when items change or palette toggles.
  useEffect(() => {
    setCursor(0)
  }, [query, open])

  // Focus input + select-all on open so re-using the palette is fast.
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      })
    } else {
      setQuery('')
    }
  }, [open])

  // Global Cmd/Ctrl-K toggle. Wired here so the palette owns its own
  // shortcut rather than relying on the App tree.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        useCommandPalette.getState().toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!open) return null

  const groups: { section: Section; items: Item[] }[] = []
  for (const section of ['recent', 'nav', 'board', 'card'] as Section[]) {
    const g = items.filter((i) => i.section === section)
    if (g.length) groups.push({ section, items: g })
  }

  // Flat list to compute keyboard navigation.
  const flat = items
  const pick = (i: number) => {
    flat[i]?.onPick()
    setOpen(false)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => Math.min(c + 1, Math.max(0, flat.length - 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => Math.max(c - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      pick(cursor)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-black/40 p-4 pt-24"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-3 dark:border-gray-700">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Jump to a board, search cards, or open a page…"
            aria-label="Search"
            className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none dark:text-gray-100"
          />
          <kbd className="hidden rounded border border-gray-300 px-1.5 py-0.5 text-[10px] text-gray-500 sm:inline dark:border-gray-600 dark:text-gray-400">
            esc
          </kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto" role="listbox">
          {flat.length === 0 ? (
            <div className="flex flex-col items-center gap-1 px-3 py-10 text-center text-sm text-gray-500">
              <Search className="h-5 w-5 text-gray-300" />
              No results for "{query}"
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.section}>
                <div className="border-t border-gray-100 px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:border-gray-700">
                  {SECTION_TITLE[g.section]}
                </div>
                {g.items.map((it) => {
                  const idx = flat.indexOf(it)
                  const active = idx === cursor
                  return (
                    <button
                      key={it.id}
                      onMouseEnter={() => setCursor(idx)}
                      onClick={() => pick(idx)}
                      className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm ${
                        active
                          ? 'bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100'
                          : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      {it.icon}
                      <span className="flex-1 truncate">{it.label}</span>
                      {it.hint && (
                        <span className="truncate text-xs text-gray-500 dark:text-gray-400">
                          {it.hint}
                        </span>
                      )}
                      {active && (
                        <CornerDownLeft className="h-3 w-3 text-gray-400" aria-hidden />
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
          <span>
            <kbd className="rounded border border-gray-300 px-1 dark:border-gray-600">↑↓</kbd> navigate
          </span>
          <span>
            <kbd className="rounded border border-gray-300 px-1 dark:border-gray-600">↵</kbd> open
          </span>
          <span>
            <kbd className="rounded border border-gray-300 px-1 dark:border-gray-600">esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  )
}
