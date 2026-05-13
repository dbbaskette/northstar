import { useEffect, useState } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { ChevronLeft, Archive, Share2, Lock, Copy, Calendar, LayoutGrid, GanttChart, BarChart3, Zap, Settings, Star } from 'lucide-react'
import { useBoard, useCopyBoard } from '@/api/boards'
import { hotkeysBus, useHotkey } from '@/hooks/useHotkeys'
import BoardView from '@/components/board/BoardView'
import BoardCalendarView from '@/components/board/BoardCalendarView'
import BoardTimelineView from '@/components/board/BoardTimelineView'
import BoardReportsView from '@/components/board/BoardReportsView'
import BoardPluginsPanel from '@/components/board/BoardPluginsPanel'
import BoardFilters, { EMPTY_FILTER, type FilterState } from '@/components/board/BoardFilters'
import BoardSharingModal from '@/components/board/BoardSharingModal'
import BoardSettingsModal from '@/components/board/BoardSettingsModal'
import AutomationsModal from '@/components/board/AutomationsModal'
import BulkActionBar from '@/components/board/BulkActionBar'
import WatchToggle from '@/components/ui/WatchToggle'
import { useSelectionStore } from '@/stores/selectionStore'
import CardModal from '@/components/card/CardModal'
import ActivityFeed from '@/components/activity/ActivityFeed'
import ArchivedPanel from '@/components/board/ArchivedPanel'
import { useBoardWebSocket } from '@/hooks/useWebSocket'
import { useBoardPrefs } from '@/lib/boardPrefs'

export default function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>()
  const { data: board, isLoading, error } = useBoard(boardId || null)
  const [activeCardId, setActiveCardId] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  // Honor ?card=... deep links (from My Work, search, etc.). Strip the
  // param after consuming it so a refresh doesn't replay it.
  useEffect(() => {
    const c = searchParams.get('card')
    if (c) {
      setActiveCardId(c)
      const next = new URLSearchParams(searchParams)
      next.delete('card')
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [showActivity, setShowActivity] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [showAutomation, setShowAutomation] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [filter, setFilter] = useState<FilterState>(EMPTY_FILTER)
  const [view, setView] = useState<'board' | 'calendar' | 'timeline' | 'reports'>('board')

  const copyBoard = useCopyBoard()

  useBoardWebSocket(boardId || null)

  // Card selection state is keyed to the active board — clear when
  // navigating between boards so a previous selection doesn't leak.
  const setSelectionBoard = useSelectionStore((s) => s.setBoard)
  const clearSelection = useSelectionStore((s) => s.clear)
  useEffect(() => {
    setSelectionBoard(boardId || null)
    return () => setSelectionBoard(null)
  }, [boardId, setSelectionBoard])
  useHotkey('escape', () => clearSelection(), { allowInInputs: false })

  // Record visits for the sidebar Recents + command palette.
  const recordVisit = useBoardPrefs((s) => s.recordVisit)
  useEffect(() => {
    if (board?.id && board.name) recordVisit({ id: board.id, name: board.name })
  }, [board?.id, board?.name, recordVisit])

  useHotkey('f', () => hotkeysBus.emit('toggle-filters'))

  if (isLoading) {
    return <BoardLoadingSkeleton />
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

  // background can be a hex color (#0079BF) or a URL pointing at an
  // uploaded image — branch on shape so the UI handles both.
  const bgIsImage =
    board.background?.startsWith('/api/') ||
    board.background?.startsWith('http://') ||
    board.background?.startsWith('https://')
  const bgStyle: React.CSSProperties = bgIsImage
    ? {
        backgroundImage: `url("${board.background}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }
    : { backgroundColor: board.background }

  return (
    <div className="flex h-full flex-col" style={bgStyle}>
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
          <FavoriteToggle boardId={board.id} />
          {board.visibility === 'private' && (
            <span
              className="inline-flex items-center gap-1 rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider"
              title="Private board — visible only to its members"
            >
              <Lock className="h-3 w-3" />
              Private
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 rounded-lg bg-white/20 p-0.5">
            <button
              onClick={() => setView('board')}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${
                view === 'board' ? 'bg-white/30' : 'hover:bg-white/10'
              }`}
              title="Board view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Board
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${
                view === 'calendar' ? 'bg-white/30' : 'hover:bg-white/10'
              }`}
              title="Calendar view"
            >
              <Calendar className="h-3.5 w-3.5" />
              Calendar
            </button>
            <button
              onClick={() => setView('timeline')}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${
                view === 'timeline' ? 'bg-white/30' : 'hover:bg-white/10'
              }`}
              title="Timeline view"
            >
              <GanttChart className="h-3.5 w-3.5" />
              Timeline
            </button>
            <button
              onClick={() => setView('reports')}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${
                view === 'reports' ? 'bg-white/30' : 'hover:bg-white/10'
              }`}
              title="Reports"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Reports
            </button>
          </div>
          <BoardFilters board={board} onChange={setFilter} />
          <button
            onClick={async () => {
              const name = prompt('Name for the copy?', `${board.name} (copy)`)
              if (!name) return
              const res = await copyBoard.mutateAsync({ boardId: board.id, name })
              window.location.href = `/boards/${res.board_id}`
            }}
            className="flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-medium hover:bg-white/30"
            title="Copy this board"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy
          </button>
          <WatchToggle
            targetType="board"
            targetID={board.id}
            label
            className="flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-medium hover:bg-white/30"
          />
          <button
            onClick={() => setShowAutomation(true)}
            className="flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-medium hover:bg-white/30"
            title="Automation rules"
          >
            <Zap className="h-3.5 w-3.5" />
            Automation
          </button>
          <button
            onClick={() => setShowShare(true)}
            className="flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-medium hover:bg-white/30"
            title="Share board"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-medium hover:bg-white/30"
            title="Board settings"
          >
            <Settings className="h-3.5 w-3.5" />
            Settings
          </button>
          <button
            onClick={() => setShowArchived(true)}
            className="flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-medium hover:bg-white/30"
            title="Archived items"
          >
            <Archive className="h-3.5 w-3.5" />
            Archived
          </button>
          <button
            onClick={() => setShowActivity(!showActivity)}
            className="rounded-lg bg-white/20 px-3 py-1.5 text-xs font-medium hover:bg-white/30"
          >
            {showActivity ? 'Hide activity' : 'Show activity'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden">
          {view === 'board' ? (
            <BoardView board={board} onCardClick={setActiveCardId} filter={filter} />
          ) : view === 'calendar' ? (
            <BoardCalendarView board={board} onCardClick={setActiveCardId} />
          ) : view === 'timeline' ? (
            <BoardTimelineView board={board} onCardClick={setActiveCardId} />
          ) : (
            <BoardReportsView boardId={board.id} />
          )}
        </div>
        {showActivity && (
          <aside className="w-80 overflow-y-auto border-l border-black/10 bg-white/95 backdrop-blur">
            <ActivityFeed boardId={board.id} />
            <BoardPluginsPanel boardId={board.id} />
          </aside>
        )}
      </div>

      <CardModal
        open={activeCardId !== null}
        cardId={activeCardId}
        board={board}
        onClose={() => setActiveCardId(null)}
      />
      <ArchivedPanel
        open={showArchived}
        boardId={board.id}
        onClose={() => setShowArchived(false)}
      />
      <BoardSharingModal
        open={showShare}
        board={board}
        onClose={() => setShowShare(false)}
      />
      <AutomationsModal
        open={showAutomation}
        board={board}
        onClose={() => setShowAutomation(false)}
      />
      <BoardSettingsModal
        open={showSettings}
        board={board}
        onClose={() => setShowSettings(false)}
      />
      <BulkActionBar board={board} />
    </div>
  )
}

function FavoriteToggle({ boardId }: { boardId: string }) {
  const isFav = useBoardPrefs((s) => s.favorites.has(boardId))
  const toggle = useBoardPrefs((s) => s.toggleFavorite)
  return (
    <button
      onClick={() => toggle(boardId)}
      aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
      aria-pressed={isFav}
      title={isFav ? 'Unfavorite' : 'Favorite'}
      className="rounded p-1 text-white/70 hover:bg-white/20 hover:text-white"
    >
      <Star
        className={`h-4 w-4 ${
          isFav ? 'fill-amber-400 stroke-amber-400 text-amber-400' : ''
        }`}
      />
    </button>
  )
}

function BoardLoadingSkeleton() {
  return (
    <div className="flex h-full flex-col bg-gray-100 dark:bg-gray-900">
      <div className="flex items-center justify-between gap-4 border-b border-black/10 bg-black/5 px-6 py-3 backdrop-blur dark:bg-white/5">
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 animate-pulse rounded bg-gray-300/70 dark:bg-gray-700" />
          <div className="h-5 w-48 animate-pulse rounded bg-gray-300/70 dark:bg-gray-700" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-7 w-20 animate-pulse rounded-md bg-gray-300/70 dark:bg-gray-700"
            />
          ))}
        </div>
      </div>
      <div className="flex flex-1 gap-4 overflow-hidden p-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex h-fit min-w-72 flex-col gap-2 rounded-lg bg-gray-200/70 p-2 dark:bg-gray-800/70"
          >
            <div className="h-5 w-32 animate-pulse rounded bg-gray-300/70 dark:bg-gray-700" />
            {Array.from({ length: 3 }).map((_, j) => (
              <div
                key={j}
                className="h-16 animate-pulse rounded-lg bg-white shadow-sm dark:bg-gray-700"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

