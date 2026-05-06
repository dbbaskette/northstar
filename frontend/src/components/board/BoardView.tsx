import { useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { useQueryClient } from '@tanstack/react-query'
import type { Board, BoardCard, BoardList } from '@/api/boards'
import { useMoveCard, useReorderCard } from '@/api/cards'
import { useReorderList } from '@/api/lists'
import { calculatePosition } from '@/lib/utils'
import SortableListColumn from './SortableListColumn'
import CardItem from '../card/CardItem'
import AddList from '../list/AddList'
import { applyFilter, type FilterState } from './BoardFilters'

interface Props {
  board: Board
  onCardClick: (cardId: string) => void
  filter: FilterState
}

export default function BoardView({ board, onCardClick, filter }: Props) {
  const qc = useQueryClient()
  const [lists, setLists] = useState<BoardList[]>(board.lists || [])
  const [activeId, setActiveId] = useState<string | null>(null)

  const moveCard = useMoveCard(board.id)
  const reorderCard = useReorderCard(board.id)
  const reorderList = useReorderList(board.id)

  useEffect(() => {
    setLists(board.lists || [])
  }, [board.lists])

  const isFiltering =
    filter.priorities.length > 0 ||
    filter.labelIds.length > 0 ||
    filter.completion !== 'all' ||
    filter.due !== 'any' ||
    filter.text !== ''

  // When filtering is active, hide non-matching cards. Drag-and-drop is
  // disabled visually since the displayed cards don't represent the full
  // ordering — but the source of truth (lists state) stays intact.
  const displayLists = useMemo(() => {
    if (!isFiltering) return lists
    return lists.map((l) => ({
      ...l,
      cards: applyFilter(l.cards || [], filter),
    }))
  }, [lists, filter, isFiltering])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const listIds = useMemo(() => lists.map((l) => l.id), [lists])
  const cardIdToListId = useMemo(() => {
    const m = new Map<string, string>()
    for (const l of lists) for (const c of l.cards || []) m.set(c.id, l.id)
    return m
  }, [lists])

  const findActiveCard = (id: string): BoardCard | null => {
    for (const l of lists) {
      const c = (l.cards || []).find((c) => c.id === id)
      if (c) return c
    }
    return null
  }

  const findActiveList = (id: string): BoardList | null => lists.find((l) => l.id === id) || null

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(e.active.id as string)
  }

  const handleDragOver = (e: DragOverEvent) => {
    const { active, over } = e
    if (!over) return
    const activeId = active.id as string
    const overId = over.id as string

    const activeListId = cardIdToListId.get(activeId)
    if (!activeListId) return

    const overListId = cardIdToListId.get(overId) || (listIds.includes(overId) ? overId : null)
    if (!overListId || activeListId === overListId) return

    setLists((prev) => {
      const sourceIdx = prev.findIndex((l) => l.id === activeListId)
      const targetIdx = prev.findIndex((l) => l.id === overListId)
      if (sourceIdx === -1 || targetIdx === -1) return prev

      const sourceList = prev[sourceIdx]!
      const targetList = prev[targetIdx]!
      const card = (sourceList.cards || []).find((c) => c.id === activeId)
      if (!card) return prev

      const newSourceCards = (sourceList.cards || []).filter((c) => c.id !== activeId)
      const overCardIdx = (targetList.cards || []).findIndex((c) => c.id === overId)
      const insertIdx = overCardIdx === -1 ? (targetList.cards || []).length : overCardIdx
      const newTargetCards = [...(targetList.cards || [])]
      newTargetCards.splice(insertIdx, 0, { ...card, list_id: targetList.id })

      const next = [...prev]
      next[sourceIdx] = { ...sourceList, cards: newSourceCards }
      next[targetIdx] = { ...targetList, cards: newTargetCards }
      return next
    })
  }

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    const activeId = active.id as string
    const overId = over.id as string

    // List reordering
    if (listIds.includes(activeId) && listIds.includes(overId) && activeId !== overId) {
      const oldIdx = lists.findIndex((l) => l.id === activeId)
      const newIdx = lists.findIndex((l) => l.id === overId)
      if (oldIdx === -1 || newIdx === -1) return

      const reordered = [...lists]
      const [moved] = reordered.splice(oldIdx, 1)
      reordered.splice(newIdx, 0, moved!)
      setLists(reordered)

      const before = newIdx > 0 ? reordered[newIdx - 1]!.position : null
      const after = newIdx < reordered.length - 1 ? reordered[newIdx + 1]!.position : null
      const position = calculatePosition(before, after)
      reorderList.mutate({ listId: activeId, position })
      return
    }

    // Card moves and reorders
    const activeListId = (() => {
      for (const l of lists) if ((l.cards || []).find((c) => c.id === activeId)) return l.id
      return null
    })()
    if (!activeListId) return

    const overListId = (() => {
      for (const l of lists) if ((l.cards || []).find((c) => c.id === overId)) return l.id
      if (listIds.includes(overId)) return overId
      return null
    })()
    if (!overListId) return

    const targetList = lists.find((l) => l.id === overListId)!
    const cards = targetList.cards || []
    const overCardIdx = cards.findIndex((c) => c.id === overId)
    const targetIdx = overCardIdx === -1 ? cards.length - 1 : overCardIdx

    const before = targetIdx > 0 ? cards[targetIdx - 1]?.position ?? null : null
    const after =
      overCardIdx === -1 ? null : targetIdx < cards.length - 1 ? cards[targetIdx + 1]?.position ?? null : null
    const newPos = calculatePosition(before, after)

    if (activeListId === overListId) {
      reorderCard.mutate({ cardId: activeId, position: newPos })
    } else {
      moveCard.mutate({ cardId: activeId, listId: overListId, position: newPos })
    }

    // Refresh from server to confirm
    setTimeout(() => {
      qc.invalidateQueries({ queryKey: ['board', board.id] })
    }, 200)
  }

  const activeCard = activeId ? findActiveCard(activeId) : null
  const activeList = activeId && !activeCard ? findActiveList(activeId) : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-1 gap-4 overflow-x-auto p-6">
        <SortableContext items={listIds} strategy={horizontalListSortingStrategy}>
          {displayLists.map((list) => (
            <SortableListColumn
              key={list.id}
              boardId={board.id}
              list={list}
              onCardClick={onCardClick}
            />
          ))}
        </SortableContext>
        <AddList boardId={board.id} />
      </div>
      <DragOverlay
        dropAnimation={{
          duration: 220,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
        }}
      >
        {activeCard ? (
          <div className="rotate-2 transform shadow-2xl ring-2 ring-blue-400/40 rounded-lg">
            <CardItem card={activeCard} onClick={() => {}} />
          </div>
        ) : activeList ? (
          <div className="min-w-72 rotate-1 transform rounded-lg bg-gray-100 p-2 shadow-2xl ring-2 ring-blue-400/40">
            <div className="px-1 py-1 text-sm font-semibold text-gray-700">{activeList.name}</div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
