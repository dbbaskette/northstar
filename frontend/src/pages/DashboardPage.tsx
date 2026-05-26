import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Star, LayoutGrid } from 'lucide-react'
import { useTeams } from '@/api/teams'
import { useTeamBoards } from '@/api/boards'
import { useAppStore } from '@/stores/appStore'
import { useBoardPrefs } from '@/lib/boardPrefs'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import CreateBoardModal from '@/components/board/CreateBoardModal'
import CreateTeamModal from '@/components/team/CreateTeamModal'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'

export default function DashboardPage() {
  useDocumentTitle('Dashboard')
  const { data: teams = [], isLoading: teamsLoading } = useTeams()
  const activeTeamId = useAppStore((s) => s.activeTeamId)
  const { data: boards = [], isLoading: boardsLoading } = useTeamBoards(activeTeamId)
  const [createBoardOpen, setCreateBoardOpen] = useState(false)
  const [createTeamOpen, setCreateTeamOpen] = useState(false)

  if (teamsLoading) {
    return (
      <div className="p-6">
        <Skeleton className="mb-2 h-7 w-40" />
        <Skeleton className="mb-6 h-4 w-24" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" rounded="lg" />
          ))}
        </div>
      </div>
    )
  }

  if (teams.length === 0) {
    return (
      <>
        <EmptyState
          icon={Star}
          title="Welcome to Northstar"
          description="Teams group people who collaborate on the same boards. Start by creating yours."
          action={
            <button
              onClick={() => setCreateTeamOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Create your first team
            </button>
          }
        />
        <CreateTeamModal open={createTeamOpen} onClose={() => setCreateTeamOpen(false)} />
      </>
    )
  }

  const activeTeam = teams.find((t) => t.id === activeTeamId) || teams[0]

  return (
    <>
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Boards</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{activeTeam?.name}</p>
          </div>
          <button
            onClick={() => setCreateBoardOpen(true)}
            disabled={!activeTeamId}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            New Board
          </button>
        </div>

        {boardsLoading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32" rounded="lg" />
            ))}
          </div>
        )}

        {!boardsLoading && boards.length === 0 ? (
          <EmptyState
            icon={LayoutGrid}
            title="No boards yet"
            description={`Boards are where ${activeTeam?.name || 'this team'} plans, tracks, and ships work. Create the first one to get rolling.`}
            action={
              <button
                onClick={() => setCreateBoardOpen(true)}
                disabled={!activeTeamId}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Create your first board
              </button>
            }
          />
        ) : !boardsLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {boards.map((board) => {
              const isImg =
                board.background?.startsWith('/api/') ||
                board.background?.startsWith('http://') ||
                board.background?.startsWith('https://')
              const tileStyle = isImg
                ? {
                    backgroundImage: `url("${board.background}")`,
                    backgroundSize: 'cover' as const,
                    backgroundPosition: 'center',
                  }
                : { backgroundColor: board.background }
              return (
                <BoardTile key={board.id} board={board} isImg={isImg} tileStyle={tileStyle} />
              )
            })}

            <button
              onClick={() => setCreateBoardOpen(true)}
              className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-gray-400 hover:bg-gray-50 hover:text-gray-700 dark:border-gray-600 dark:text-gray-400 dark:hover:border-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Board
            </button>
          </div>
        ) : null}
      </div>

      {activeTeamId && (
        <CreateBoardModal
          open={createBoardOpen}
          onClose={() => setCreateBoardOpen(false)}
          teamId={activeTeamId}
        />
      )}
    </>
  )
}

function BoardTile({
  board,
  isImg,
  tileStyle,
}: {
  board: { id: string; name: string; created_at: string }
  isImg: boolean
  tileStyle: React.CSSProperties
}) {
  const isFav = useBoardPrefs((s) => s.favorites.has(board.id))
  const toggleFav = useBoardPrefs((s) => s.toggleFavorite)
  return (
    <div className="group relative">
      <Link
        to={`/boards/${board.id}`}
        className="relative flex h-32 flex-col justify-between overflow-hidden rounded-lg p-4 text-white shadow-sm transition hover:shadow-md"
        style={tileStyle}
      >
        {isImg && (
          <span
            className="absolute inset-0 bg-gradient-to-br from-black/0 via-black/0 to-black/40"
            aria-hidden
          />
        )}
        <span className="relative font-semibold drop-shadow">{board.name}</span>
        <span className="relative text-xs opacity-90 drop-shadow">
          Created {new Date(board.created_at).toLocaleDateString()}
        </span>
      </Link>
      <button
        onClick={(e) => {
          e.preventDefault()
          toggleFav(board.id)
        }}
        aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
        aria-pressed={isFav}
        title={isFav ? 'Unfavorite' : 'Favorite'}
        className={`absolute right-2 top-2 rounded-full p-1.5 transition ${
          isFav
            ? 'bg-black/30 text-amber-300 opacity-100'
            : 'bg-black/0 text-white/80 opacity-0 group-hover:bg-black/30 group-hover:opacity-100'
        }`}
      >
        <Star className={`h-4 w-4 ${isFav ? 'fill-amber-400 stroke-amber-400' : ''}`} />
      </button>
    </div>
  )
}
