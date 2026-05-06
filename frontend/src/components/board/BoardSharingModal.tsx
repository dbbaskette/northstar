import { useState } from 'react'
import { Lock, Users, X, Trash2, Link as LinkIcon, Copy, Check, Webhook as WebhookIcon, Plug } from 'lucide-react'
import {
  useAddBoardMember,
  useBoardMembers,
  useRemoveBoardMember,
  useUpdateBoardVisibility,
} from '@/api/boardMembers'
import { useCreateInvite, useDeleteInvite, useInvites } from '@/api/invites'
import { useToggleTemplate } from '@/api/templates'
import { useCreateWebhook, useDeleteWebhook, useWebhooks } from '@/api/webhooks'
import { useUsers } from '@/api/users'
import { useUpdateStaleThreshold, type Board } from '@/api/boards'
import {
  useBoardPlugins,
  useDisableBoardPlugin,
  useEnableBoardPlugin,
  usePlugins,
} from '@/api/plugins'
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
  const toggleTemplate = useToggleTemplate(board.id)
  const { data: webhooks = [] } = useWebhooks(open ? board.id : null)
  const createWebhook = useCreateWebhook(board.id)
  const deleteWebhook = useDeleteWebhook(board.id)
  const updateStaleThreshold = useUpdateStaleThreshold(board.id)
  const { data: registry = [] } = usePlugins()
  const { data: enabledPlugins = [] } = useBoardPlugins(open ? board.id : null)
  const enablePlugin = useEnableBoardPlugin(board.id)
  const disablePlugin = useDisableBoardPlugin(board.id)
  const enabledIds = new Set(enabledPlugins.map((p) => p.plugin_id))
  const [staleDraft, setStaleDraft] = useState<string>(
    String(board.stale_threshold_days || 14),
  )
  const [newWebhookUrl, setNewWebhookUrl] = useState('')
  const [newWebhookFormat, setNewWebhookFormat] = useState<'raw' | 'google_chat'>('raw')
  const [showWebhookSecret, setShowWebhookSecret] = useState<string | null>(null)
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

          <section>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={board.is_template}
                onChange={(e) => toggleTemplate.mutate(e.target.checked)}
                className="h-4 w-4 rounded"
              />
              <span className="text-gray-700 dark:text-gray-300">Use this board as a template</span>
            </label>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Templates show up under "My templates" when creating a new board.
            </p>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Stale card threshold
              </span>
            </div>
            <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
              Cards with no edit in this many days get an aging dot on the board.
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                const days = parseInt(staleDraft, 10)
                if (isNaN(days)) return
                try {
                  await updateStaleThreshold.mutateAsync(days)
                  setError('')
                } catch (err) {
                  const e = err as { response?: { data?: { error?: string } } }
                  setError(e.response?.data?.error || 'Could not save threshold')
                }
              }}
              className="flex items-center gap-2"
            >
              <input
                type="number"
                min={1}
                max={365}
                value={staleDraft}
                onChange={(e) => setStaleDraft(e.target.value)}
                aria-label="Stale threshold in days"
                className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700"
              />
              <span className="text-xs text-gray-500">days</span>
              <button
                type="submit"
                disabled={String(board.stale_threshold_days) === staleDraft}
                className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Save
              </button>
            </form>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <WebhookIcon className="h-3.5 w-3.5" />
                Webhooks
              </span>
            </div>
            <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
              POST every board event to a URL. Pick <span className="font-medium">Google Chat</span> if
              you're pasting in an incoming-webhook URL from a Workspace space — events will be
              wrapped as a chat message. Otherwise the raw signed payload is sent with{' '}
              <code className="rounded bg-gray-100 px-1 dark:bg-gray-700">X-Northstar-Signature</code>.
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (!newWebhookUrl.trim()) return
                const created = await createWebhook.mutateAsync({
                  url: newWebhookUrl.trim(),
                  format: newWebhookFormat,
                })
                setNewWebhookUrl('')
                setNewWebhookFormat('raw')
                setShowWebhookSecret(created.secret)
              }}
              className="mb-3 flex flex-wrap gap-2"
            >
              <input
                type="url"
                value={newWebhookUrl}
                onChange={(e) => setNewWebhookUrl(e.target.value)}
                placeholder="https://example.com/webhook"
                className="flex-1 min-w-48 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
              <select
                value={newWebhookFormat}
                onChange={(e) => setNewWebhookFormat(e.target.value as 'raw' | 'google_chat')}
                className="rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              >
                <option value="raw">Raw (signed)</option>
                <option value="google_chat">Google Chat</option>
              </select>
              <button
                type="submit"
                disabled={!newWebhookUrl.trim() || createWebhook.isPending}
                className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Add
              </button>
            </form>
            {showWebhookSecret && (
              <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs dark:border-amber-700 dark:bg-amber-900/30">
                <div className="mb-1 font-semibold text-amber-800 dark:text-amber-200">
                  Signing secret — copy this now
                </div>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={showWebhookSecret}
                    onFocus={(e) => e.currentTarget.select()}
                    className="flex-1 rounded bg-white px-2 py-1 font-mono text-xs text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                  />
                  <button
                    onClick={() => setShowWebhookSecret(null)}
                    className="rounded px-2 text-amber-800 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-800"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
            {webhooks.length === 0 ? (
              <div className="text-xs text-gray-400">No webhooks configured.</div>
            ) : (
              <div className="space-y-1.5">
                {webhooks.map((wh) => (
                  <div
                    key={wh.id}
                    className="flex items-center gap-2 rounded-lg border border-gray-200 px-2 py-1.5 text-xs dark:border-gray-700"
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${wh.active ? 'bg-green-500' : 'bg-gray-300'}`}
                    />
                    <span className="flex-1 truncate font-mono text-xs text-gray-700 dark:text-gray-300">
                      {wh.url}
                    </span>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                      {wh.format === 'google_chat' ? 'gchat' : 'raw'}
                    </span>
                    <button
                      onClick={() => deleteWebhook.mutate(wh.id)}
                      className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {registry.length > 0 && (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <Plug className="h-3.5 w-3.5" />
                  Plugins
                </span>
              </div>
              <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                Enable workspace plugins on this board. Each plugin renders its own iframe in
                the board sidebar.
              </p>
              <ul className="space-y-1.5">
                {registry.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-gray-200 px-2 py-1.5 text-xs dark:border-gray-700"
                  >
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {p.name} <span className="text-gray-500">v{p.version}</span>
                      </div>
                      {p.description && (
                        <div className="text-gray-500">{p.description}</div>
                      )}
                    </div>
                    {enabledIds.has(p.id) ? (
                      <button
                        onClick={() => disablePlugin.mutate(p.id)}
                        className="rounded-md bg-gray-100 px-2 py-1 font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200"
                      >
                        Disable
                      </button>
                    ) : (
                      <button
                        onClick={() => enablePlugin.mutate(p.id)}
                        className="rounded-md bg-blue-600 px-2 py-1 font-medium text-white hover:bg-blue-700"
                      >
                        Enable
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

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
