import { useMemo, useState } from 'react'
import type { Board, BoardCard } from '@/api/boards'
import { cardCompletedAt, cardDueDate, cardStartDate } from '@/lib/cardHelpers'

interface Props {
  board: Board
  onCardClick: (cardId: string) => void
}

interface TimelineEntry {
  card: BoardCard
  listName: string
  listIdx: number
  start: Date
  end: Date
}

const DAY_MS = 24 * 60 * 60 * 1000

// Distinct hues for list-based coloring; cycles if there are more lists.
const LIST_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#EC4899', '#84CC16', '#F97316', '#6366F1',
]

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function dayDiff(a: Date, b: Date): number {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / DAY_MS)
}

export default function BoardTimelineView({ board, onCardClick }: Props) {
  const [zoom, setZoom] = useState<'week' | 'month' | 'quarter'>('month')

  const entries: TimelineEntry[] = useMemo(() => {
    const out: TimelineEntry[] = []
    ;(board.lists || []).forEach((list, listIdx) => {
      ;(list.cards || []).forEach((card) => {
        const due = cardDueDate(card)
        if (!due) return // a card needs at least a due date to appear
        const start = cardStartDate(card) ?? due
        out.push({
          card,
          listName: list.name,
          listIdx,
          start: startOfDay(start <= due ? start : due),
          end: startOfDay(due),
        })
      })
    })
    return out.sort((a, b) => a.start.getTime() - b.start.getTime())
  }, [board.lists])

  // Day window: from earliest start (or today, whichever is sooner) to
  // latest due (or today + 30, whichever is later). Padded by 3 days on
  // each side so bars don't hug the edge.
  const range = useMemo(() => {
    const today = startOfDay(new Date())
    let min = today
    let max = addDays(today, 30)
    for (const e of entries) {
      if (e.start < min) min = e.start
      if (e.end > max) max = e.end
    }
    return { min: addDays(min, -3), max: addDays(max, 3) }
  }, [entries])

  const totalDays = dayDiff(range.max, range.min) + 1
  const dayWidth = zoom === 'week' ? 36 : zoom === 'month' ? 18 : 8
  const todayX = dayDiff(new Date(), range.min) * dayWidth

  // Build month-header buckets so the user can read the timeline.
  const monthBuckets = useMemo(() => {
    const buckets: { label: string; days: number; offset: number }[] = []
    let cursor = new Date(range.min)
    cursor.setDate(1)
    let offset = -dayDiff(range.min, cursor)
    while (cursor <= range.max) {
      const next = new Date(cursor)
      next.setMonth(next.getMonth() + 1)
      const monthStart = cursor < range.min ? range.min : cursor
      const monthEnd = next > range.max ? addDays(range.max, 1) : next
      const days = dayDiff(monthEnd, monthStart)
      buckets.push({
        label: cursor.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
        days,
        offset,
      })
      offset += days
      cursor = next
    }
    return buckets
  }, [range, dayWidth])

  if (entries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-white/95 p-6 text-center text-sm text-gray-600 dark:bg-gray-900/90">
        No cards have due dates yet. Cards appear here once they get one.
      </div>
    )
  }

  const totalWidth = totalDays * dayWidth

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white/95 dark:bg-gray-900/90">
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-2 dark:border-gray-700">
        <div className="text-xs text-gray-600 dark:text-gray-300">
          {entries.length} cards on the timeline
        </div>
        <div className="flex gap-1 rounded-md bg-gray-100 p-0.5 dark:bg-gray-800">
          {(['week', 'month', 'quarter'] as const).map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={`rounded-sm px-2 py-0.5 text-xs font-medium ${
                zoom === z
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100'
                  : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              {z}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="relative" style={{ width: totalWidth + 16 }}>
          {/* Month header */}
          <div className="sticky top-0 z-10 flex border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
            {monthBuckets.map((b, i) => (
              <div
                key={i}
                className="flex-shrink-0 border-r border-gray-200 px-2 py-1 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200"
                style={{ width: b.days * dayWidth }}
              >
                {b.label}
              </div>
            ))}
          </div>

          {/* Today vertical line */}
          {todayX >= 0 && todayX <= totalWidth && (
            <div
              className="pointer-events-none absolute top-0 z-0 h-full w-px bg-blue-500/60"
              style={{ left: todayX }}
              aria-hidden
            />
          )}

          {/* Bars */}
          <div className="space-y-1 py-2">
            {entries.map((e) => {
              const left = dayDiff(e.start, range.min) * dayWidth
              const width = Math.max((dayDiff(e.end, e.start) + 1) * dayWidth, 8)
              const completed = !!cardCompletedAt(e.card)
              const color = LIST_COLORS[e.listIdx % LIST_COLORS.length]!
              return (
                <div
                  key={e.card.id}
                  className="relative h-7 px-2"
                  style={{ width: totalWidth }}
                >
                  <button
                    onClick={() => onCardClick(e.card.id)}
                    className="group absolute top-0 h-6 truncate rounded-md px-2 text-left text-xs text-white shadow-sm transition hover:brightness-110 focus:outline-none"
                    style={{
                      left,
                      width,
                      backgroundColor: color,
                      opacity: completed ? 0.5 : 1,
                      textDecoration: completed ? 'line-through' : 'none',
                    }}
                    title={`${e.card.title} — ${e.listName}\n${e.start.toLocaleDateString()} → ${e.end.toLocaleDateString()}`}
                  >
                    {e.card.title}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 px-4 py-2 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
        Bars run from the card's start date (defaults to its due date when none is set) to its
        due date. Click a bar to edit. Drag-to-reschedule and dependency arrows are coming soon.
      </div>
    </div>
  )
}
