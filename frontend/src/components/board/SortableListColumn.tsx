import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { BoardList } from '@/api/boards'
import { useArchiveList, useCopyList, useUpdateList } from '@/api/lists'
import { useMemo, useState } from 'react'
import { MoreHorizontal, Trash2, Copy, ArrowDownAZ, ThumbsUp } from 'lucide-react'
import SortableCard from './SortableCard'
import AddCard from '../card/AddCard'
import { confirmDialog } from '../ui/ConfirmDialog'
import { toast } from '@/lib/toast'

interface Props {
  boardId: string
  list: BoardList
  onCardClick: (cardId: string) => void
  staleThresholdDays?: number
  board?: import('@/api/boards').Board
}

export default function SortableListColumn({ boardId, list, onCardClick, staleThresholdDays, board }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: list.id, data: { type: 'list' } })

  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(list.name)
  const [menuOpen, setMenuOpen] = useState(false)
  const [sortBy, setSortBy] = useState<'manual' | 'votes'>('manual')
  const updateList = useUpdateList(boardId)
  const archiveList = useArchiveList(boardId)
  const copyList = useCopyList(boardId)

  const handleSaveName = async () => {
    if (name.trim() && name !== list.name) {
      await updateList.mutateAsync({ listId: list.id, name: name.trim() })
    }
    setEditingName(false)
  }

  const handleDelete = async () => {
    setMenuOpen(false)
    const ok = await confirmDialog({
      title: `Archive "${list.name}"?`,
      body: 'Cards in the list stay archived too. Restore from the Archived panel.',
      confirmLabel: 'Archive list',
      danger: true,
    })
    if (!ok) return
    await archiveList.mutateAsync(list.id)
    toast.success('List archived')
  }

  const orderedCards = useMemo(() => {
    const cards = list.cards || []
    if (sortBy !== 'votes') return cards
    return [...cards].sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0))
  }, [list.cards, sortBy])
  const cardIds = orderedCards.map((c) => c.id)

  return (
    <div
      ref={setNodeRef}
      data-list-id={list.id}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="flex h-fit max-h-full min-w-72 flex-col rounded-lg bg-gray-100 p-2 dark:bg-gray-800"
    >
      <div className="mb-2 flex items-center justify-between gap-2 px-1 py-1">
        {editingName ? (
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveName()
              if (e.key === 'Escape') {
                setName(list.name)
                setEditingName(false)
              }
            }}
            className="flex-1 rounded border border-blue-500 bg-white px-2 py-0.5 text-sm font-semibold focus:outline-none"
            autoFocus
          />
        ) : (
          <button
            {...attributes}
            {...listeners}
            onDoubleClick={() => setEditingName(true)}
            className="flex-1 cursor-grab text-left text-sm font-semibold text-gray-700 active:cursor-grabbing dark:text-gray-200"
          >
            {list.name}
          </button>
        )}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded p-1 text-gray-500 hover:bg-gray-200"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <button
                  onClick={() => {
                    setSortBy(sortBy === 'votes' ? 'manual' : 'votes')
                    setMenuOpen(false)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  {sortBy === 'votes' ? (
                    <>
                      <ArrowDownAZ className="h-4 w-4" />
                      Manual order
                    </>
                  ) : (
                    <>
                      <ThumbsUp className="h-4 w-4" />
                      Sort by votes
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    copyList.mutate(list.id)
                    setMenuOpen(false)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <Copy className="h-4 w-4" />
                  Copy list
                </button>
                <button
                  onClick={handleDelete}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="h-4 w-4" />
                  Archive list
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 overflow-y-auto px-1 min-h-1">
          {(orderedCards).map((card) => (
            <SortableCard
              key={card.id}
              card={card}
              onCardClick={onCardClick}
              staleThresholdDays={staleThresholdDays}
              boardId={boardId}
              list={{ ...list, cards: orderedCards }}
              board={board}
            />
          ))}
        </div>
      </SortableContext>

      <div className="mt-2 px-1">
        <AddCard boardId={boardId} listId={list.id} />
      </div>
    </div>
  )
}
