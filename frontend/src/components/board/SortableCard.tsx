import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Board, BoardCard, BoardList } from '@/api/boards'
import CardItem from '../card/CardItem'
import CardContextMenu from './CardContextMenu'
import { useSelectionStore } from '@/stores/selectionStore'

interface Props {
  card: BoardCard
  onCardClick: (cardId: string) => void
  staleThresholdDays?: number
  boardId?: string
  // Pass the parent list's card list so shift+click can compute a
  // contiguous range from the anchor.
  list?: BoardList
  // Full board reference so the context menu can show "move to list"
  // and "add label" submenus.
  board?: Board
}

export default function SortableCard({
  card,
  onCardClick,
  staleThresholdDays,
  boardId,
  list,
  board,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id, data: { type: 'card', listId: card.list_id } })

  const selected = useSelectionStore((s) => s.selected.has(card.id))
  const selectionSize = useSelectionStore((s) => s.selected.size)
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null)

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!board) return
    e.preventDefault()
    setMenuPos({ x: e.clientX, y: e.clientY })
  }

  const handleClick = (e: React.MouseEvent) => {
    const meta = e.metaKey || e.ctrlKey
    const shift = e.shiftKey

    // Cmd/Ctrl-click: toggle this card's selection.
    if (meta) {
      useSelectionStore.getState().toggle(card.id)
      return
    }

    // Shift-click: extend selection from anchor to here, but only when
    // both anchor and this card belong to the same list (kanban
    // ranges across lists are confusing — use cmd-click for that).
    if (shift && list) {
      const ids = (list.cards || []).map((c) => c.id)
      const anchor = useSelectionStore.getState().anchor
      const anchorIdx = anchor ? ids.indexOf(anchor) : -1
      const thisIdx = ids.indexOf(card.id)
      if (anchorIdx !== -1 && thisIdx !== -1) {
        const [a, b] = anchorIdx < thisIdx ? [anchorIdx, thisIdx] : [thisIdx, anchorIdx]
        useSelectionStore.getState().selectMany(ids.slice(a, b + 1))
        return
      }
      // Fall through to plain click when there's no anchor in this list.
    }

    // Plain click while bulk mode is active: toggle, don't open the modal.
    if (selectionSize > 0) {
      useSelectionStore.getState().toggle(card.id)
      return
    }

    onCardClick(card.id)
  }

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
        }}
        {...attributes}
        {...listeners}
        className="rounded-lg border-2 border-dashed border-blue-400 bg-blue-50/30"
      >
        <div className="invisible">
          <CardItem card={card} onClick={() => {}} />
        </div>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      data-card-id={card.id}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      {...attributes}
      {...listeners}
    >
      <CardItem
        card={card}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        staleThresholdDays={staleThresholdDays}
        boardId={boardId}
        selected={selected}
      />
      {menuPos && board && (
        <CardContextMenu
          card={card}
          board={board}
          pos={menuPos}
          onOpenCard={() => onCardClick(card.id)}
          onClose={() => setMenuPos(null)}
        />
      )}
    </div>
  )
}
