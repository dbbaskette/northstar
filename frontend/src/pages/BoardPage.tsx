import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useBoard } from '@/api/boards'
import BoardView from '@/components/board/BoardView'
import CardModal from '@/components/card/CardModal'
import ActivityFeed from '@/components/activity/ActivityFeed'
import { useBoardWebSocket } from '@/hooks/useWebSocket'

export default function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>()
  const { data: board, isLoading, error } = useBoard(boardId || null)
  const [activeCardId, setActiveCardId] = useState<string | null>(null)
  const [showActivity, setShowActivity] = useState(false)

  useBoardWebSocket(boardId || null)

  if (isLoading) {
    return <div className="p-6 text-sm text-gray-500">Loading board...</div>
  }

  if (error || !board) {
    return (
      <div className="p-6">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to dashboard
        </Link>
        <div className="mt-4 text-sm text-red-600">Board not found.</div>
      </div>
    )
  }

  return (
    <div
      className="flex h-full flex-col"
      style={{ backgroundColor: board.background }}
    >
      <div className="flex items-center justify-between gap-4 border-b border-black/10 bg-black/10 px-6 py-3 text-white backdrop-blur">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="rounded p-1 hover:bg-white/20"
            title="Back to dashboard"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <h2 className="text-lg font-semibold">{board.name}</h2>
        </div>
        <button
          onClick={() => setShowActivity(!showActivity)}
          className="rounded-lg bg-white/20 px-3 py-1.5 text-xs font-medium hover:bg-white/30"
        >
          {showActivity ? 'Hide activity' : 'Show activity'}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <BoardView board={board} onCardClick={setActiveCardId} />
        </div>
        {showActivity && (
          <aside className="w-80 overflow-y-auto border-l border-black/10 bg-white/95 backdrop-blur">
            <ActivityFeed boardId={board.id} />
          </aside>
        )}
      </div>

      <CardModal
        open={activeCardId !== null}
        cardId={activeCardId}
        board={board}
        onClose={() => setActiveCardId(null)}
      />
    </div>
  )
}
