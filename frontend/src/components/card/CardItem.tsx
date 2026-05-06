import { Calendar, Check, CheckSquare, Paperclip, ThumbsUp, Eye } from 'lucide-react'
import type { BoardCard } from '@/api/boards'
import { useVoteCard } from '@/api/cards'
import { useCardViewerCount } from '@/hooks/usePresence'
import {
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  cardCompletedAt,
  cardCoverColor,
  cardCoverImageURL,
  cardCoverSize,
  cardDueDate,
  cardPriority,
} from '@/lib/cardHelpers'

interface Props {
  card: BoardCard
  onClick: () => void
  isDragging?: boolean
  staleThresholdDays?: number
  boardId?: string
}

export default function CardItem({ card, onClick, isDragging, staleThresholdDays, boardId }: Props) {
  const voteCard = useVoteCard(boardId || '')
  const viewerCount = useCardViewerCount(card.id)
  const priority = cardPriority(card)
  const dueDate = cardDueDate(card)
  const completedAt = cardCompletedAt(card)
  const coverImage = cardCoverImageURL(card)
  const coverColor = cardCoverColor(card)
  const coverSize = cardCoverSize(card)
  const isOverdue = dueDate && !completedAt && dueDate.getTime() < Date.now()

  // Stale = no edit since `staleThresholdDays` ago. Completed cards are
  // never marked stale even if old.
  const staleDays = (() => {
    if (!staleThresholdDays || completedAt || !card.updated_at) return null
    const ageMs = Date.now() - new Date(card.updated_at).getTime()
    const days = Math.floor(ageMs / (24 * 60 * 60 * 1000))
    return days >= staleThresholdDays ? days : null
  })()

  const ariaLabel = (() => {
    const bits: string[] = [`Card: ${card.title}`]
    if (priority) bits.push(`priority ${PRIORITY_LABELS[priority]}`)
    if (dueDate)
      bits.push(`${isOverdue ? 'overdue, due' : 'due'} ${dueDate.toLocaleDateString()}`)
    if (completedAt) bits.push('completed')
    return bits.join(', ')
  })()

  const handleKeyActivate = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick()
    }
  }

  // Full cover: image fills the whole card thumbnail with title overlaid.
  if (coverImage && coverSize === 'full') {
    return (
      <div
        onClick={onClick}
        onKeyDown={handleKeyActivate}
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        className={`group cursor-pointer overflow-hidden rounded-lg border-l-4 shadow-sm transition-shadow hover:shadow-md ${
          isDragging ? 'opacity-50' : ''
        } ${completedAt ? 'opacity-70' : ''}`}
        style={{
          borderLeftColor: priority ? PRIORITY_COLORS[priority] : 'transparent',
        }}
      >
        <div
          className="relative h-32 w-full bg-cover bg-center"
          style={{ backgroundImage: `url("${coverImage}")` }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/60" />
          <div className="absolute bottom-0 left-0 right-0 p-3 text-sm font-medium text-white">
            {card.title}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={onClick}
      onKeyDown={handleKeyActivate}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      className={`group cursor-pointer overflow-hidden rounded-lg border-l-4 bg-white shadow-sm transition-shadow hover:shadow-md dark:bg-gray-800 ${
        isDragging ? 'opacity-50' : ''
      } ${completedAt ? 'opacity-70' : ''}`}
      style={{
        borderLeftColor: priority ? PRIORITY_COLORS[priority] : 'transparent',
      }}
    >
      {/* Half cover: image or color band at top */}
      {coverImage && coverSize !== 'full' && (
        <div
          className="h-20 w-full bg-cover bg-center"
          style={{ backgroundImage: `url("${coverImage}")` }}
        />
      )}
      {!coverImage && coverColor && (
        <div className="h-8 w-full" style={{ backgroundColor: coverColor }} />
      )}

      <div className="p-3 text-sm">
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
            <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              <Paperclip className="h-3 w-3" />
              {card.attachment_count}
            </span>
          )}
          {staleDays !== null && (
            <span
              className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200"
              title={`No updates in ${staleDays} days`}
              aria-label={`Stale: no updates in ${staleDays} days`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              {staleDays}d
            </span>
          )}
          {viewerCount > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
              title={`${viewerCount} ${viewerCount === 1 ? 'person is' : 'people are'} viewing this card`}
              aria-label={`${viewerCount} active viewer${viewerCount > 1 ? 's' : ''}`}
            >
              <Eye className="h-3 w-3" />
              {viewerCount}
            </span>
          )}
          {boardId && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                voteCard.mutate({ cardId: card.id, vote: !card.viewer_voted })
              }}
              aria-label={card.viewer_voted ? 'Remove vote' : 'Vote for this card'}
              aria-pressed={card.viewer_voted}
              className={`ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition ${
                card.viewer_voted
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200'
                  : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
              }`}
            >
              <ThumbsUp className="h-3 w-3" />
              {card.vote_count || 0}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
