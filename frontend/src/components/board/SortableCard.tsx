import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { BoardCard } from '@/api/boards'
import CardItem from '../card/CardItem'

interface Props {
  card: BoardCard
  onCardClick: (cardId: string) => void
  staleThresholdDays?: number
  boardId?: string
}

export default function SortableCard({ card, onCardClick, staleThresholdDays, boardId }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id, data: { type: 'card', listId: card.list_id } })

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
        onClick={() => onCardClick(card.id)}
        staleThresholdDays={staleThresholdDays}
        boardId={boardId}
      />
    </div>
  )
}
