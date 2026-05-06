import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useTeams } from '@/api/teams'
import { useTeamBoards } from '@/api/boards'
import { useAppStore } from '@/stores/appStore'
import CreateBoardModal from '@/components/board/CreateBoardModal'
import CreateTeamModal from '@/components/team/CreateTeamModal'

export default function DashboardPage() {
  const { data: teams = [], isLoading: teamsLoading } = useTeams()
  const activeTeamId = useAppStore((s) => s.activeTeamId)
  const { data: boards = [], isLoading: boardsLoading } = useTeamBoards(activeTeamId)
  const [createBoardOpen, setCreateBoardOpen] = useState(false)
  const [createTeamOpen, setCreateTeamOpen] = useState(false)

  if (teamsLoading) {
    return <div className="p-6 text-sm text-gray-500">Loading...</div>
  }

  if (teams.length === 0) {
    return (
      <>
        <div className="flex h-full flex-col items-center justify-center p-6 text-center">
          <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100">Welcome to Northstar</h1>
          <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">Create a team to get started.</p>
          <button
            onClick={() => setCreateTeamOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Create your first team
          </button>
        </div>
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

        {boardsLoading && <div className="text-sm text-gray-500">Loading boards...</div>}

        {!boardsLoading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {boards.map((board) => (
              <Link
                key={board.id}
                to={`/boards/${board.id}`}
                className="group flex h-32 flex-col justify-between rounded-lg p-4 text-white shadow-sm transition hover:shadow-md"
                style={{ backgroundColor: board.background }}
              >
                <span className="font-semibold">{board.name}</span>
                <span className="text-xs opacity-75">
                  Created {new Date(board.created_at).toLocaleDateString()}
                </span>
              </Link>
            ))}

            <button
              onClick={() => setCreateBoardOpen(true)}
              className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-gray-400 hover:bg-gray-50 hover:text-gray-700 dark:border-gray-600 dark:text-gray-400 dark:hover:border-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            >
              <Plus className="mr-2 h-4 w-4" />
              {boards.length === 0 ? 'Create your first board' : 'New Board'}
            </button>
          </div>
        )}
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
