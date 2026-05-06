import { Calendar, Check, CheckSquare, Paperclip } from 'lucide-react'
import type { BoardCard } from '@/api/boards'
import {
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  cardCompletedAt,
  cardDueDate,
  cardPriority,
} from '@/lib/cardHelpers'

interface Props {
  card: BoardCard
  onClick: () => void
  isDragging?: boolean
}

export default function CardItem({ card, onClick, isDragging }: Props) {
  const priority = cardPriority(card)
  const dueDate = cardDueDate(card)
  const completedAt = cardCompletedAt(card)
  const isOverdue = dueDate && !completedAt && dueDate.getTime() < Date.now()

  return (
    <div
      onClick={onClick}
      className={`group cursor-pointer rounded-lg border-l-4 bg-white p-3 text-sm shadow-sm transition-shadow hover:shadow-md dark:bg-gray-800 ${
        isDragging ? 'opacity-50' : ''
      } ${completedAt ? 'opacity-70' : ''}`}
      style={{
        borderLeftColor: priority ? PRIORITY_COLORS[priority] : 'transparent',
      }}
    >
      <div className="flex items-start gap-2">
        {completedAt && (
          <div className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-green-500 text-white">
            <Check className="h-3 w-3" strokeWidth={3} />
          </div>
        )}
        <div
          className={`flex-1 ${completedAt ? 'text-gray-500 line-through dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}
        >
          {card.title}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        {priority && (
          <span
            className="rounded px-1.5 py-0.5 font-medium text-white"
            style={{ backgroundColor: PRIORITY_COLORS[priority] }}
          >
            {PRIORITY_LABELS[priority]}
          </span>
        )}
        {dueDate && (
          <span
            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${
              completedAt
                ? 'bg-green-100 text-green-700'
                : isOverdue
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            <Calendar className="h-3 w-3" />
            {dueDate.toLocaleDateString()}
          </span>
        )}
        {(card.checklist_total ?? 0) > 0 && (
          <span
            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${
              card.checklist_done === card.checklist_total
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            <CheckSquare className="h-3 w-3" />
            {card.checklist_done}/{card.checklist_total}
          </span>
        )}
        {(card.attachment_count ?? 0) > 0 && (
          <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-gray-600">
            <Paperclip className="h-3 w-3" />
            {card.attachment_count}
          </span>
        )}
      </div>
    </div>
  )
}
