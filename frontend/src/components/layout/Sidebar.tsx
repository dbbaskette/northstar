import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Lock,
  Star,
  Plus,
  Plug,
  Users,
  ShieldCheck,
  UserCog,
  UserPlus,
  Inbox,
  Clock,
  Search,
} from 'lucide-react'
import { useTeams } from '@/api/teams'
import { useMyBoards } from '@/api/boards'
import { useMe } from '@/api/users'
import { useAppStore } from '@/stores/appStore'
import { useBoardPrefs } from '@/lib/boardPrefs'
import CreateTeamModal from '../team/CreateTeamModal'
import TeamMembersModal from '../team/TeamMembersModal'

interface SidebarProps {
  onNavigate?: () => void
}

export default function Sidebar({ onNavigate }: SidebarProps = {}) {
  const { data: teams = [], isLoading } = useTeams()
  const { data: allBoards = [] } = useMyBoards()
  const { data: me } = useMe()
  const activeTeamId = useAppStore((s) => s.activeTeamId)
  const setActiveTeam = useAppStore((s) => s.setActiveTeam)
  const [createOpen, setCreateOpen] = useState(false)
  const [membersTeamId, setMembersTeamId] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const location = useLocation()

  const favorites = useBoardPrefs((s) => s.favorites)
  const recents = useBoardPrefs((s) => s.recents)

  useEffect(() => {
    if (!activeTeamId && teams.length > 0) {
      setActiveTeam(teams[0]!.id)
    }
    if (activeTeamId && teams.length > 0 && !teams.find((t) => t.id === activeTeamId)) {
      setActiveTeam(teams[0]!.id)
    }
  }, [teams, activeTeamId, setActiveTeam])

  // Map board id → board record for favorites/recents lookup. Avoids
  // showing a "ghost" entry for a board the viewer can no longer see.
  const boardsById = useMemo(() => {
    const m = new Map<string, (typeof allBoards)[number]>()
    for (const b of allBoards) m.set(b.id, b)
    return m
  }, [allBoards])

  const favoriteBoards = useMemo(
    () => Array.from(favorites).map((id) => boardsById.get(id)).filter(Boolean) as typeof allBoards,
    [favorites, boardsById],
  )

  const recentBoards = useMemo(
    () =>
      recents
        .map((r) => boardsById.get(r.id) || { id: r.id, name: r.name, team_id: '', team_name: '', background: '', visibility: 'team' as const })
        .filter((b) => !favorites.has(b.id))
        .slice(0, 4),
    [recents, boardsById, favorites],
  )

  const filteredTeams = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return teams
    return teams.filter((t) => t.name.toLowerCase().includes(q))
  }, [teams, filter])

  // Active boardId from the current path (so we can highlight the right
  // recent / favorite). location.pathname looks like /boards/<uuid>.
  const activeBoardId = location.pathname.match(/^\/boards\/([^/?#]+)/)?.[1] || null

  return (
    <>
      <aside className="flex w-64 flex-col border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="flex h-14 items-center gap-2 border-b border-gray-200 px-4 dark:border-gray-700">
          <Star className="h-6 w-6 text-blue-600" />
          <span className="text-lg font-bold text-gray-900 dark:text-gray-100">Northstar</span>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          <Link
            to="/my-work"
            onClick={onNavigate}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <Inbox className="h-4 w-4" />
            My work
          </Link>

          <Link
            to="/dashboard"
            onClick={onNavigate}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>

          <Link
            to="/security"
            onClick={onNavigate}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <Lock className="h-4 w-4" />
            Security
          </Link>

          {me?.role === 'admin' && (
            <>
              <Link
                to="/admin/users"
                onClick={onNavigate}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                <UserCog className="h-4 w-4" />
                Users
              </Link>
              <Link
                to="/admin/audit-log"
                onClick={onNavigate}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                <ShieldCheck className="h-4 w-4" />
                Audit log
              </Link>
              <Link
                to="/admin/plugins"
                onClick={onNavigate}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                <Plug className="h-4 w-4" />
                Plugins
              </Link>
            </>
          )}

          {favoriteBoards.length > 0 && (
            <SidebarSection
              icon={<Star className="h-3.5 w-3.5 fill-amber-400 stroke-amber-500" />}
              title="Favorites"
            >
              {favoriteBoards.map((b) => (
                <BoardRow
                  key={b.id}
                  to={`/boards/${b.id}`}
                  active={activeBoardId === b.id}
                  name={b.name}
                  hint={b.team_name}
                  onNavigate={onNavigate}
                />
              ))}
            </SidebarSection>
          )}

          {recentBoards.length > 0 && (
            <SidebarSection
              icon={<Clock className="h-3.5 w-3.5 text-gray-400" />}
              title="Recent"
            >
              {recentBoards.map((b) => (
                <BoardRow
                  key={b.id}
                  to={`/boards/${b.id}`}
                  active={activeBoardId === b.id}
                  name={b.name}
                  hint={b.team_name}
                  onNavigate={onNavigate}
                />
              ))}
            </SidebarSection>
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

            {teams.length > 5 && (
              <div className="relative mb-1 px-2">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filter teams…"
                  aria-label="Filter teams"
                  className="w-full rounded-md border border-gray-200 bg-gray-50 py-1 pl-6 pr-2 text-xs text-gray-700 placeholder-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:focus:bg-gray-800"
                />
              </div>
            )}

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

            {filteredTeams.map((t) => (
              <div
                key={t.id}
                className={`group flex items-center gap-1 rounded-lg pr-1 transition ${
                  activeTeamId === t.id
                    ? 'bg-blue-50 dark:bg-blue-900/30'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <button
                  onClick={() => {
                    setActiveTeam(t.id)
                    onNavigate?.()
                  }}
                  className={`flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${
                    activeTeamId === t.id
                      ? 'font-medium text-blue-700 dark:text-blue-300'
                      : 'text-gray-700 dark:text-gray-200'
                  }`}
                >
                  <Users className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{t.name}</span>
                </button>
                <button
                  onClick={() => setMembersTeamId(t.id)}
                  aria-label={`Manage members of ${t.name}`}
                  title="Manage members"
                  className="rounded p-1 text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-white hover:text-gray-700 focus:opacity-100 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {teams.length > 0 && filteredTeams.length === 0 && (
              <div className="px-3 py-2 text-xs text-gray-400">No teams match.</div>
            )}
          </div>
        </nav>
      </aside>

      <CreateTeamModal open={createOpen} onClose={() => setCreateOpen(false)} />
      {membersTeamId && (
        <TeamMembersModal
          open={!!membersTeamId}
          teamId={membersTeamId}
          onClose={() => setMembersTeamId(null)}
        />
      )}
    </>
  )
}

function SidebarSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="pt-4">
      <div className="mb-1 flex items-center gap-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {icon}
        {title}
      </div>
      {children}
    </div>
  )
}

function BoardRow({
  to,
  active,
  name,
  hint,
  onNavigate,
}: {
  to: string
  active: boolean
  name: string
  hint?: string
  onNavigate?: () => void
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition ${
        active
          ? 'bg-blue-50 font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
      }`}
    >
      <span className="h-2 w-2 flex-shrink-0 rounded-full bg-gray-300 dark:bg-gray-600" />
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {hint && (
        <span className="hidden truncate text-[10px] text-gray-400 sm:inline">{hint}</span>
      )}
    </Link>
  )
}
