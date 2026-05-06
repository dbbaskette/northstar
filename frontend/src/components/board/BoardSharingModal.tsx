import { useState } from 'react'
import { Lock, Users, X, Trash2, Link as LinkIcon, Copy, Check } from 'lucide-react'
import {
  useAddBoardMember,
  useBoardMembers,
  useRemoveBoardMember,
  useUpdateBoardVisibility,
} from '@/api/boardMembers'
import { useCreateInvite, useDeleteInvite, useInvites } from '@/api/invites'
import { useUsers } from '@/api/users'
import type { Board } from '@/api/boards'
import Avatar from '../ui/Avatar'

interface Props {
  open: boolean
  board: Board
  onClose: () => void
}

export default function BoardSharingModal({ open, board, onClose }: Props) {
  const { data: members = [] } = useBoardMembers(open ? board.id : null)
  const { data: allUsers = [] } = useUsers()
  const { data: invites = [] } = useInvites(open ? board.id : null)
  const updateVisibility = useUpdateBoardVisibility(board.id)
  const addMember = useAddBoardMember(board.id)
  const removeMember = useRemoveBoardMember(board.id)
  const createInvite = useCreateInvite(board.id)
  const deleteInvite = useDeleteInvite(board.id)
  const [error, setError] = useState('')
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  const inviteUrl = (token: string) => `${window.location.origin}/invites/${token}`

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(inviteUrl(token))
      setCopiedToken(token)
      setTimeout(() => setCopiedToken(null), 1500)
    } catch {
      // ignore
    }
  }

  const pendingInvites = invites.filter((i) => !i.accepted_at?.Valid)

  if (!open) return null

  const isPrivate = board.visibility === 'private'
  const memberUserIds = new Set(members.map((m) => m.user_id))
  const availableUsers = allUsers.filter((u) => !memberUserIds.has(u.id))

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-20"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white shadow-xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 p-6 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Share board</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 p-6">
          {error && (
            <div className="rounded-lg bg-red-50 p-2 text-xs text-red-600 dark:bg-red-900/30 dark:text-red-300">
              {error}
            </div>
          )}

          <section>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Visibility
            </div>
            <div className="space-y-2">
              <button
                onClick={async () => {
                  setError('')
                  try {
                    await updateVisibility.mutateAsync('team')
                  } catch (err: unknown) {
                    setError(
                      (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                        'Failed to update',
                    )
                  }
                }}
                className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left ${
                  !isPrivate
                    ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/30'
                    : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700'
                }`}
              >
                <Users className={`mt-0.5 h-5 w-5 ${!isPrivate ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Team</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Anyone on the team can view and edit.
                  </div>
                </div>
              </button>
              <button
                onClick={async () => {
                  setError('')
                  try {
                    await updateVisibility.mutateAsync('private')
                  } catch (err: unknown) {
                    setError(
                      (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                        'Failed to update',
                    )
                  }
                }}
                className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left ${
                  isPrivate
                    ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/30'
                    : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700'
                }`}
              >
                <Lock className={`mt-0.5 h-5 w-5 ${isPrivate ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Private</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Only the people listed below can see this board.
                  </div>
                </div>
              </button>
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Invite link
              </span>
              <button
                onClick={async () => {
                  setError('')
                  try {
                    await createInvite.mutateAsync({ role: 'member', expires_in_days: 14 })
                  } catch (err: unknown) {
                    setError(
                      (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                        'Failed to create invite',
                    )
                  }
                }}
                disabled={createInvite.isPending}
                className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <LinkIcon className="h-3.5 w-3.5" />
                {createInvite.isPending ? 'Creating…' : 'New invite'}
              </button>
            </div>
            {pendingInvites.length === 0 ? (
              <div className="text-xs text-gray-400">
                No active invites. Click <span className="font-medium">New invite</span> to generate a shareable link.
              </div>
            ) : (
              <div className="space-y-2">
                {pendingInvites.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-700"
                  >
                    <input
                      readOnly
                      value={inviteUrl(inv.token)}
                      onFocus={(e) => e.currentTarget.select()}
                      className="flex-1 truncate rounded bg-white px-2 py-1 font-mono text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    />
                    <button
                      onClick={() => copy(inv.token)}
                      className="rounded p-1.5 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-600 dark:hover:text-gray-200"
                      title="Copy"
                    >
                      {copiedToken === inv.token ? (
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => deleteInvite.mutate(inv.id)}
                      className="rounded p-1.5 text-gray-400 hover:bg-gray-200 hover:text-red-600 dark:hover:bg-gray-600"
                      title="Revoke"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {isPrivate && (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Members ({members.length})
                </span>
              </div>

              <div className="mb-3 space-y-2">
                {members.map((m) => (
                  <div
                    key={m.user_id}
                    className="flex items-center gap-3 rounded-lg border border-gray-200 p-2 dark:border-gray-700"
                  >
                    {m.user && (
                      <Avatar
                        user={{ id: m.user.id, display_name: m.user.display_name, avatar_url: m.user.avatar_url }}
                        size="md"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                        {m.user?.display_name}
                      </div>
                      <div className="truncate text-xs text-gray-500 dark:text-gray-400">{m.user?.email}</div>
                    </div>
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 capitalize dark:bg-gray-700 dark:text-gray-200">
                      {m.role}
                    </span>
                    <button
                      onClick={() => removeMember.mutate(m.user_id)}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-700"
                      title="Remove from board"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {members.length === 0 && (
                  <div className="text-xs text-gray-400">No members yet — only you can see this board.</div>
                )}
              </div>

              {availableUsers.length > 0 && (
                <div>
                  <div className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">Add user</div>
                  <select
                    onChange={async (e) => {
                      if (!e.target.value) return
                      await addMember.mutateAsync({ user_id: e.target.value, role: 'member' })
                      e.target.value = ''
                    }}
                    className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                    defaultValue=""
                  >
                    <option value="">Select a user…</option>
                    {availableUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.display_name} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
