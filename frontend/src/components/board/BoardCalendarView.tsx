import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Board, BoardCard } from '@/api/boards'
import { useUpdateCard } from '@/api/cards'
import { cardCompletedAt, cardDueDate, cardPriority, PRIORITY_COLORS } from '@/lib/cardHelpers'

interface Props {
  board: Board
  onCardClick: (cardId: string) => void
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function BoardCalendarView({ board, onCardClick }: Props) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const updateCard = useUpdateCard(board.id)

  const allCards = useMemo(() => {
    const out: BoardCard[] = []
    for (const list of board.lists || []) {
      for (const c of list.cards || []) {
        if (cardDueDate(c)) out.push(c)
      }
    }
    return out
  }, [board])

  const cardsByDay = useMemo(() => {
    const map: Record<string, BoardCard[]> = {}
    for (const c of allCards) {
      const due = cardDueDate(c)
      if (!due) continue
      const key = ymd(due)
      if (!map[key]) map[key] = []
      map[key].push(c)
    }
    return map
  }, [allCards])

  const monthGrid = useMemo(() => buildMonthGrid(cursor), [cursor])

  const handleDrop = (card: BoardCard, targetDate: Date) => {
    const due = new Date(targetDate)
    due.setHours(12, 0, 0, 0)
    updateCard.mutate({
      cardId: card.id,
      title: card.title,
      description: '',
      due_date: due.toISOString(),
    })
  }

  const monthLabel = cursor.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-4 flex items-center justify-between text-white">
        <h3 className="text-lg font-semibold">{monthLabel}</h3>
        <div className="flex items-center gap-1 rounded-lg bg-white/20 p-0.5">
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="rounded p-1 hover:bg-white/20"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              const d = new Date()
              setCursor(new Date(d.getFullYear(), d.getMonth(), 1))
            }}
            className="rounded px-2 py-0.5 text-xs hover:bg-white/20"
          >
            Today
          </button>
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="rounded p-1 hover:bg-white/20"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden rounded-lg bg-white shadow-sm dark:bg-gray-800">
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-700">
          {DAYS_OF_WEEK.map((d) => (
            <div
              key={d}
              className="px-2 py-1.5 text-center text-xs font-semibold text-gray-600 dark:text-gray-300"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid flex-1 grid-cols-7 grid-rows-6 divide-x divide-y divide-gray-200 overflow-auto dark:divide-gray-700">
          {monthGrid.map((day) => (
            <DayCell
              key={day.date.toISOString()}
              day={day}
              cards={cardsByDay[ymd(day.date)] || []}
              onCardClick={onCardClick}
              onDrop={handleDrop}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

interface CalendarDay {
  date: Date
  inMonth: boolean
  isToday: boolean
}

function buildMonthGrid(cursor: Date): CalendarDay[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const start = new Date(cursor)
  start.setDate(1 - cursor.getDay())
  start.setHours(0, 0, 0, 0)

  const days: CalendarDay[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    days.push({
      date: d,
      inMonth: d.getMonth() === cursor.getMonth(),
      isToday: ymd(d) === ymd(today),
    })
  }
  return days
}

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function DayCell({
  day,
  cards,
  onCardClick,
  onDrop,
}: {
  day: CalendarDay
  cards: BoardCard[]
  onCardClick: (cardId: string) => void
  onDrop: (card: BoardCard, target: Date) => void
}) {
  const [draggingOver, setDraggingOver] = useState(false)

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDraggingOver(true)
      }}
      onDragLeave={() => setDraggingOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDraggingOver(false)
        const cardId = e.dataTransfer.getData('text/plain')
        const card = cards.find((c) => c.id === cardId)
        // Card might be coming from a different day — caller looks it up in the board
        if (card) onDrop(card, day.date)
        else {
          // Try to find via dataTransfer JSON
          try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'))
            onDrop(data, day.date)
          } catch {
            // ignore
          }
        }
      }}
      className={`flex min-h-24 flex-col p-1.5 text-xs transition-colors ${
        day.inMonth
          ? 'bg-white dark:bg-gray-800'
          : 'bg-gray-50 text-gray-400 dark:bg-gray-900 dark:text-gray-600'
      } ${draggingOver ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}
    >
      <div
        className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
          day.isToday
            ? 'bg-blue-600 font-bold text-white'
            : day.inMonth
              ? 'text-gray-700 dark:text-gray-300'
              : 'text-gray-400'
        }`}
      >
        {day.date.getDate()}
      </div>
      <div className="flex flex-col gap-1 overflow-hidden">
        {cards.slice(0, 4).map((card) => {
          const completed = cardCompletedAt(card)
          const priority = cardPriority(card)
          const overdue = !completed && card && cardDueDate(card)! < new Date(new Date().setHours(0, 0, 0, 0))
          return (
            <div
              key={card.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', card.id)
                e.dataTransfer.setData('application/json', JSON.stringify(card))
              }}
              onClick={() => onCardClick(card.id)}
              className={`cursor-pointer truncate rounded border-l-2 bg-gray-50 px-1.5 py-0.5 text-xs transition-shadow hover:shadow-sm dark:bg-gray-700 ${
                completed
                  ? 'text-gray-400 line-through dark:text-gray-500'
                  : overdue
                    ? 'text-red-700 dark:text-red-300'
                    : 'text-gray-800 dark:text-gray-200'
              }`}
              style={{
                borderLeftColor: priority ? PRIORITY_COLORS[priority] : '#cbd5e1',
              }}
              title={card.title}
            >
              {card.title}
            </div>
          )
        })}
        {cards.length > 4 && (
          <div className="text-xs text-gray-500 dark:text-gray-400">+{cards.length - 4} more</div>
        )}
      </div>
    </div>
  )
}
