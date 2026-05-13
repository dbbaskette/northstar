import { useEffect, useRef, useState } from 'react'
import { CalendarDays, MessageSquare, Paperclip, Tag } from 'lucide-react'
import { useCard } from '@/api/cards'
import {
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  cardCompletedAt,
  cardDescription,
  cardDueDate,
  cardPriority,
} from '@/lib/cardHelpers'

// Floating preview that appears when the user hovers a card-row for a
// short delay. Designed for non-board contexts (My Work, search
// results) — on a board the card is already visible so a preview
// would just be noise.
interface Props {
  // Card id to lazy-fetch. Null hides the preview.
  cardId: string | null
  // Anchor rectangle (in viewport coords) to position around.
  anchor: DOMRect | null
  onClose: () => void
}

const PREVIEW_WIDTH = 360
const HIDE_DELAY = 80

export default function CardHoverPreview({ cardId, anchor, onClose }: Props) {
  const { data: card, isLoading } = useCard(cardId)
  const ref = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (!anchor) {
      setPos(null)
      return
    }
    const vw = window.innerWidth
    const vh = window.innerHeight
    // Default: place to the right of the anchor; flip to left if there's no room.
    const wantedLeft = anchor.right + 8
    const left =
      wantedLeft + PREVIEW_WIDTH > vw - 8
        ? Math.max(8, anchor.left - PREVIEW_WIDTH - 8)
        : wantedLeft
    // Default: align the preview's top with the anchor's top; nudge up if
    // it would spill off the bottom of the viewport.
    let top = anchor.top
    // Estimate height after render — bound to half the viewport to be safe.
    const estH = Math.min(vh * 0.5, 320)
    if (top + estH > vh - 8) top = Math.max(8, vh - estH - 8)
    setPos({ top, left })
  }, [anchor])

  if (!cardId || !anchor || !pos) return null

  const priority = card ? cardPriority(card) : null
  const due = card ? cardDueDate(card) : null
  const completed = card ? cardCompletedAt(card) : null
  const desc = card ? cardDescription(card) : ''

  return (
    <div
      ref={ref}
      role="tooltip"
      style={{ top: pos.top, left: pos.left, width: PREVIEW_WIDTH }}
      // Keep mouse interactions inside the preview from closing it.
      onMouseEnter={() => clearTimeout((window as unknown as { __nspv?: number }).__nspv)}
      onMouseLeave={() => {
        ;(window as unknown as { __nspv?: number }).__nspv = window.setTimeout(onClose, HIDE_DELAY)
      }}
      className="pointer-events-auto fixed z-[75] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800"
    >
      {isLoading || !card ? (
        <div className="space-y-2 p-4">
          <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-12 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      ) : (
        <>
          <div className="space-y-2 p-4">
            <div
              className={`text-sm font-semibold ${
                completed
                  ? 'text-gray-500 line-through dark:text-gray-500'
                  : 'text-gray-900 dark:text-gray-100'
              }`}
            >
              {card.title}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              {priority && (
                <span
                  className="rounded px-1.5 py-0.5 font-medium text-white"
                  style={{ backgroundColor: PRIORITY_COLORS[priority] }}
                >
                  {PRIORITY_LABELS[priority]}
                </span>
              )}
              {due && (
                <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                  <CalendarDays className="h-3 w-3" />
                  {due.toLocaleDateString()}
                </span>
              )}
              {(card.labels || []).map((l) => (
                <span
                  key={l.id}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-white"
                  style={{ backgroundColor: l.color }}
                >
                  <Tag className="h-2.5 w-2.5" />
                  {l.name}
                </span>
              ))}
            </div>

            {desc && (
              <p className="line-clamp-4 whitespace-pre-wrap text-xs text-gray-600 dark:text-gray-300">
                {desc}
              </p>
            )}
          </div>

          {((card.comments?.length ?? 0) > 0 || (card.attachments?.length ?? 0) > 0) && (
            <div className="flex items-center gap-3 border-t border-gray-100 bg-gray-50 px-4 py-2 text-[11px] text-gray-500 dark:border-gray-700 dark:bg-gray-900/40">
              {(card.comments?.length ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {card.comments?.length}
                </span>
              )}
              {(card.attachments?.length ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Paperclip className="h-3 w-3" />
                  {card.attachments?.length}
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Hook helper used by lists of cards. Manages hover delay + single
// active preview state per parent.
export function useHoverPreview() {
  const [state, setState] = useState<{ cardId: string; anchor: DOMRect } | null>(null)
  const timerRef = useRef<number | null>(null)

  const show = (cardId: string, target: HTMLElement) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      setState({ cardId, anchor: target.getBoundingClientRect() })
    }, 400)
  }
  const cancel = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    ;(window as unknown as { __nspv?: number }).__nspv = window.setTimeout(
      () => setState(null),
      HIDE_DELAY,
    )
  }
  const close = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setState(null)
  }

  return { state, show, cancel, close }
}
