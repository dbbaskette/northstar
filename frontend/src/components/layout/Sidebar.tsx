import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LayoutDashboard, Star, Plus, Users, ShieldCheck } from 'lucide-react'
import { useTeams } from '@/api/teams'
import { useMe } from '@/api/users'
import { useAppStore } from '@/stores/appStore'
import CreateTeamModal from '../team/CreateTeamModal'

interface SidebarProps {
  onNavigate?: () => void
}

export default function Sidebar({ onNavigate }: SidebarProps = {}) {
  const { data: teams = [], isLoading } = useTeams()
  const { data: me } = useMe()
  const activeTeamId = useAppStore((s) => s.activeTeamId)
  const setActiveTeam = useAppStore((s) => s.setActiveTeam)
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    if (!activeTeamId && teams.length > 0) {
      setActiveTeam(teams[0]!.id)
    }
    if (activeTeamId && teams.length > 0 && !teams.find((t) => t.id === activeTeamId)) {
      setActiveTeam(teams[0]!.id)
    }
  }, [teams, activeTeamId, setActiveTeam])

  return (
    <>
      <aside className="flex w-64 flex-col border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="flex h-14 items-center gap-2 border-b border-gray-200 px-4 dark:border-gray-700">
          <Star className="h-6 w-6 text-blue-600" />
          <span className="text-lg font-bold text-gray-900 dark:text-gray-100">Northstar</span>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          <Link
            to="/dashboard"
            onClick={onNavigate}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>

          {me?.role === 'admin' && (
            <Link
              to="/admin/audit-log"
              onClick={onNavigate}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <ShieldCheck className="h-4 w-4" />
              Audit log
            </Link>
          )}

          <div className="pt-4">
            <div className="mb-2 flex items-center justify-between px-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Teams
              </span>
              <button
                onClick={() => setCreateOpen(true)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                title="Create team"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {isLoading && (
              <div className="px-3 py-2 text-xs text-gray-400">Loading...</div>
            )}

            {!isLoading && teams.length === 0 && (
              <button
                onClick={() => setCreateOpen(true)}
                className="w-full rounded-lg border border-dashed border-gray-300 px-3 py-2 text-left text-xs text-gray-500 hover:border-gray-400 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:border-gray-500 dark:hover:bg-gray-700"
              >
                Create your first team
              </button>
            )}

            {teams.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setActiveTeam(t.id)
                  onNavigate?.()
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                  activeTeamId === t.id
                    ? 'bg-blue-50 font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <Users className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{t.name}</span>
              </button>
            ))}
          </div>
        </nav>
      </aside>

      <CreateTeamModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  )
}
