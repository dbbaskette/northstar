import { useMemo, useState } from 'react'
import { Users, X, Trash2, UserPlus } from 'lucide-react'
import {
  useAddTeamMember,
  useRemoveTeamMember,
  useTeam,
  useUpdateTeamMember,
  type TeamMember,
} from '@/api/teams'
import { useUsers } from '@/api/users'
import { useMe } from '@/api/users'
import Avatar from '../ui/Avatar'
import { confirmDialog } from '../ui/ConfirmDialog'
import { toast } from '@/lib/toast'

interface Props {
  open: boolean
  teamId: string
  onClose: () => void
}

const ROLES: TeamMember['role'][] = ['owner', 'admin', 'member', 'viewer']

export default function TeamMembersModal({ open, teamId, onClose }: Props) {
  const { data, isLoading } = useTeam(open ? teamId : null)
  const { data: allUsers = [] } = useUsers()
  const { data: me } = useMe()
  const addMember = useAddTeamMember(teamId)
  const removeMember = useRemoveTeamMember(teamId)
  const updateMember = useUpdateTeamMember(teamId)

  const [pickUserId, setPickUserId] = useState('')
  const [pickRole, setPickRole] = useState<TeamMember['role']>('member')

  const team = data?.team
  const members = data?.members || []

  // Determine the viewer's role on this team — owners and admins can
  // mutate; everyone else gets a read-only list.
  const myRole = useMemo(() => {
    if (!me) return null
    return members.find((m) => m.user_id === me.id)?.role ?? null
  }, [members, me])
  const canManage = myRole === 'owner' || myRole === 'admin'

  const memberIds = new Set(members.map((m) => m.user_id))
  const candidates = allUsers.filter((u) => !memberIds.has(u.id))

  if (!open) return null

  const handleAdd = async () => {
    if (!pickUserId) return
    try {
      await addMember.mutateAsync({ userId: pickUserId, role: pickRole })
      toast.success('Member added')
      setPickUserId('')
      setPickRole('member')
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e.response?.data?.error || 'Could not add member')
    }
  }

  const handleRemove = async (m: TeamMember) => {
    const ok = await confirmDialog({
      title: `Remove ${m.user?.display_name || 'this user'} from the team?`,
      body: 'They lose access to every team-visibility board immediately. Their authored cards/comments stay.',
      confirmLabel: 'Remove',
      danger: true,
    })
    if (!ok) return
    try {
      await removeMember.mutateAsync(m.user_id)
      toast.success('Member removed')
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e.response?.data?.error || 'Could not remove')
    }
  }

  const handleRoleChange = async (m: TeamMember, role: TeamMember['role']) => {
    try {
      await updateMember.mutateAsync({ userId: m.user_id, role })
      toast.success('Role updated')
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e.response?.data?.error || 'Could not update role')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-20"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="team-members-title"
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white shadow-xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 p-6 dark:border-gray-700">
          <div>
            <h2
              id="team-members-title"
              className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100"
            >
              <Users className="h-4 w-4" />
              {team?.name || 'Team'} members
            </h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Members see every team-visibility board. Mark a board private from its Share
              modal to scope it tighter.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-6">
          {canManage && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Add a member
              </h3>
              {candidates.length === 0 ? (
                <p className="text-xs text-gray-500">
                  Everyone is already on the team.
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={pickUserId}
                    onChange={(e) => setPickUserId(e.target.value)}
                    aria-label="User to add"
                    className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700"
                  >
                    <option value="">Pick a user…</option>
                    {candidates.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.display_name} ({u.email})
                      </option>
                    ))}
                  </select>
                  <select
                    value={pickRole}
                    onChange={(e) => setPickRole(e.target.value as TeamMember['role'])}
                    aria-label="Role"
                    className="rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700"
                  >
                    {ROLES.filter((r) => r !== 'owner').map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAdd}
                    disabled={!pickUserId || addMember.isPending}
                    className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Add
                  </button>
                </div>
              )}
            </section>
          )}

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Current ({members.length})
            </h3>
            {isLoading ? (
              <div className="text-xs text-gray-500">Loading…</div>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {members.map((m) => (
                  <li key={m.user_id} className="flex items-center gap-3 py-2">
                    {m.user && (
                      <Avatar
                        user={{
                          id: m.user.id,
                          display_name: m.user.display_name,
                        }}
                        size="sm"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                        {m.user?.display_name || m.user_id}
                        {me?.id === m.user_id && (
                          <span className="ml-2 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-blue-700">
                            you
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-gray-500">
                        {m.user?.email}
                      </div>
                    </div>
                    {canManage && m.role !== 'owner' ? (
                      <select
                        value={m.role}
                        onChange={(e) =>
                          handleRoleChange(m, e.target.value as TeamMember['role'])
                        }
                        aria-label={`Role for ${m.user?.display_name || 'member'}`}
                        className="rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700"
                      >
                        {ROLES.filter((r) => r !== 'owner').map((r) => (
                          <option key={r}>{r}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        {m.role}
                      </span>
                    )}
                    {canManage && m.role !== 'owner' && me?.id !== m.user_id && (
                      <button
                        onClick={() => handleRemove(m)}
                        aria-label={`Remove ${m.user?.display_name || 'member'}`}
                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-gray-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                ))}
                {members.length === 0 && !isLoading && (
                  <li className="py-2 text-xs text-gray-500">No members yet.</li>
                )}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
