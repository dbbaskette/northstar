import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Filter, X } from 'lucide-react'
import type { Board, BoardCard, BoardLabel, CardPriority } from '@/api/boards'
import { PRIORITY_COLORS, PRIORITY_LABELS, PRIORITY_ORDER, cardCompletedAt, cardDueDate, cardPriority } from '@/lib/cardHelpers'
import { hotkeysBus } from '@/hooks/useHotkeys'

export interface FilterState {
  priorities: CardPriority[]
  labelIds: string[]
  completion: 'all' | 'completed' | 'open'
  due: 'any' | 'overdue' | 'week' | 'month' | 'none'
  text: string
}

const EMPTY: FilterState = {
  priorities: [],
  labelIds: [],
  completion: 'all',
  due: 'any',
  text: '',
}

interface Props {
  board: Board
  onChange: (filter: FilterState) => void
}

export default function BoardFilters({ board, onChange }: Props) {
  const [params, setParams] = useSearchParams()
  const [open, setOpen] = useState(false)
  const textInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const offToggle = hotkeysBus.on('toggle-filters', () => setOpen((v) => !v))
    const offFocus = hotkeysBus.on('focus-search', () => {
      setOpen(true)
      // Wait for the popover to mount before focusing.
      requestAnimationFrame(() => textInputRef.current?.focus())
    })
    return () => {
      offToggle()
      offFocus()
    }
  }, [])

  const filter: FilterState = {
    priorities: parseList(params.get('priority')) as CardPriority[],
    labelIds: parseList(params.get('label')),
    completion: (params.get('completion') as FilterState['completion']) || 'all',
    due: (params.get('due') as FilterState['due']) || 'any',
    text: params.get('text') || '',
  }

  useEffect(() => {
    onChange(filter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const updateParam = (k: string, v: string | null) => {
    const next = new URLSearchParams(params)
    if (v && v !== '' && v !== 'all' && v !== 'any') next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true })
  }

  const toggleListParam = (k: string, v: string) => {
    const cur = parseList(params.get(k))
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]
    updateParam(k, next.join(','))
  }

  const isActive =
    filter.priorities.length > 0 ||
    filter.labelIds.length > 0 ||
    filter.completion !== 'all' ||
    filter.due !== 'any' ||
    filter.text !== ''

  const activeCount =
    filter.priorities.length +
    filter.labelIds.length +
    (filter.completion !== 'all' ? 1 : 0) +
    (filter.due !== 'any' ? 1 : 0) +
    (filter.text ? 1 : 0)

  const clearAll = () => {
    setParams(new URLSearchParams(), { replace: true })
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
          isActive ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-white/20 text-white hover:bg-white/30'
        }`}
      >
        <Filter className="h-3.5 w-3.5" />
        Filters
        {activeCount > 0 && (
          <span className="ml-1 rounded-full bg-white/30 px-1.5 py-0.5 text-[10px]">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-2 w-80 rounded-xl border border-gray-200 bg-white p-4 shadow-xl text-gray-900">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold">Filter cards</span>
              {isActive && (
                <button
                  onClick={clearAll}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>

            <FilterSection label="Priority">
              <div className="flex flex-wrap gap-1.5">
                {PRIORITY_ORDER.map((p) => {
                  const active = filter.priorities.includes(p)
                  return (
                    <button
                      key={p}
                      onClick={() => toggleListParam('priority', p)}
                      className={`rounded-md border-2 px-2 py-0.5 text-xs font-medium ${
                        active ? 'text-white' : 'bg-white text-gray-600'
                      }`}
                      style={{
                        borderColor: PRIORITY_COLORS[p],
                        backgroundColor: active ? PRIORITY_COLORS[p] : undefined,
                      }}
                    >
                      {PRIORITY_LABELS[p]}
                    </button>
                  )
                })}
              </div>
            </FilterSection>

            {(board.labels || []).length > 0 && (
              <FilterSection label="Labels">
                <div className="flex flex-wrap gap-1.5">
                  {(board.labels || []).map((l: BoardLabel) => {
                    const active = filter.labelIds.includes(l.id)
                    return (
                      <button
                        key={l.id}
                        onClick={() => toggleListParam('label', l.id)}
                        className={`rounded px-2 py-0.5 text-xs font-medium text-white transition-opacity ${
                          active ? 'ring-2 ring-gray-700 ring-offset-1' : 'opacity-70 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: l.color }}
                      >
                        {l.name}
                      </button>
                    )
                  })}
                </div>
              </FilterSection>
            )}

            <FilterSection label="Completion">
              <div className="flex gap-1.5">
                {(['all', 'open', 'completed'] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => updateParam('completion', opt)}
                    className={`flex-1 rounded-md border px-2 py-0.5 text-xs font-medium ${
                      filter.completion === opt
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {opt === 'all' ? 'All' : opt === 'open' ? 'Open' : 'Completed'}
                  </button>
                ))}
              </div>
            </FilterSection>

            <FilterSection label="Due date">
              <div className="grid grid-cols-2 gap-1.5">
                {(['any', 'overdue', 'week', 'month', 'none'] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => updateParam('due', opt)}
                    className={`rounded-md border px-2 py-0.5 text-xs font-medium ${
                      filter.due === opt
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {DUE_LABELS[opt]}
                  </button>
                ))}
              </div>
            </FilterSection>

            <FilterSection label="Title contains">
              <div className="relative">
                <input
                  ref={textInputRef}
                  type="text"
                  value={filter.text}
                  onChange={(e) => updateParam('text', e.target.value)}
                  aria-label="Search card titles in this board"
                  placeholder="Search in this board..."
                  className="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
                {filter.text && (
                  <button
                    onClick={() => updateParam('text', '')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </FilterSection>
          </div>
        </>
      )}
    </div>
  )
}

function FilterSection({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-3">
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </div>
      {children}
    </div>
  )
}

const DUE_LABELS: Record<FilterState['due'], string> = {
  any: 'Any',
  overdue: 'Overdue',
  week: 'This week',
  month: 'This month',
  none: 'No due date',
}

function parseList(v: string | null): string[] {
  if (!v) return []
  return v.split(',').filter(Boolean)
}

// Hook for applying a FilterState to a list of cards.
export function applyFilter(cards: BoardCard[], filter: FilterState): BoardCard[] {
  if (!cards.length) return cards
  const now = new Date()
  const startOfWeek = startOf(now, 'week')
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(endOfWeek.getDate() + 7)
  const startOfMonth = startOf(now, 'month')
  const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 1)

  return cards.filter((c) => {
    if (filter.priorities.length > 0) {
      const p = cardPriority(c)
      if (!p || !filter.priorities.includes(p)) return false
    }

    if (filter.labelIds.length > 0) {
      const ids = (c.labels || []).map((l) => l.id)
      if (!filter.labelIds.some((id) => ids.includes(id))) return false
    }

    if (filter.completion !== 'all') {
      const completed = cardCompletedAt(c) !== null
      if (filter.completion === 'completed' && !completed) return false
      if (filter.completion === 'open' && completed) return false
    }

    if (filter.due !== 'any') {
      const due = cardDueDate(c)
      if (filter.due === 'none') {
        if (due) return false
      } else if (filter.due === 'overdue') {
        if (!due || due >= now || cardCompletedAt(c)) return false
      } else if (filter.due === 'week') {
        if (!due || due < startOfWeek || due >= endOfWeek) return false
      } else if (filter.due === 'month') {
        if (!due || due < startOfMonth || due >= endOfMonth) return false
      }
    }

    if (filter.text) {
      const t = filter.text.toLowerCase()
      if (!c.title.toLowerCase().includes(t)) return false
    }

    return true
  })
}

function startOf(d: Date, unit: 'week' | 'month'): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  if (unit === 'week') {
    x.setDate(x.getDate() - x.getDay())
  } else {
    x.setDate(1)
  }
  return x
}

export const EMPTY_FILTER = EMPTY
