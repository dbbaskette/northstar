import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Search, UserCheck, Trash2, ClockAlert, UserPlus } from 'lucide-react'
import {
  useAdminUsers,
  useApproveUser,
  useBulkRole,
  useDeleteUser,
  useRevokeSessions,
  useUpdateAdminUser,
  type AdminUser,
} from '@/api/adminUsers'
import { useMe } from '@/api/users'
import { confirmDialog } from '@/components/ui/ConfirmDialog'
import { toast } from '@/lib/toast'
import Skeleton from '@/components/ui/Skeleton'
import CreateUserModal from '@/components/admin/CreateUserModal'

const ROLES = ['admin', 'member', 'viewer'] as const

export default function AdminUsersPage() {
  const { data: me, isLoading: meLoading } = useMe()
  const { data: users = [], isLoading } = useAdminUsers()
  const updateUser = useUpdateAdminUser()
  const revokeSessions = useRevokeSessions()
  const approveUser = useApproveUser()
  const deleteUser = useDeleteUser()
  const bulkRole = useBulkRole()

  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkRoleValue, setBulkRoleValue] = useState<string>('member')
  const [createOpen, setCreateOpen] = useState(false)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return users
    return users.filter((u) =>
      [u.display_name, u.email, u.username].some((f) => f.toLowerCase().includes(term)),
    )
  }, [users, search])

  if (meLoading) {
    return <div className="p-6 text-sm text-gray-500">Loading…</div>
  }
  if (!me || me.role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Users</h1>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Approve new accounts, change roles, deactivate or delete users, and revoke
            active sessions.
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <UserPlus className="h-4 w-4" />
          Create user
        </button>
      </div>

      {(() => {
        const pending = users.filter((u) => !u.approved_at)
        if (pending.length === 0) return null
        return (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <ClockAlert className="h-4 w-4" />
              <span className="font-semibold">
                {pending.length} {pending.length === 1 ? 'account is' : 'accounts are'} pending
                approval
              </span>
            </div>
            <p className="mt-1 text-xs">
              Pending users can't sign in until you approve them. They appear at the top of
              the list below.
            </p>
          </div>
        )
      })()}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, username"
            aria-label="Search users"
            className="rounded-md border border-gray-300 py-1.5 pl-7 pr-3 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-600 dark:text-gray-400">{selected.size} selected</span>
            <select
              value={bulkRoleValue}
              onChange={(e) => setBulkRoleValue(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-700"
            >
              {ROLES.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
            <button
              onClick={async () => {
                await bulkRole.mutateAsync({
                  user_ids: Array.from(selected),
                  role: bulkRoleValue,
                })
                setSelected(new Set())
              }}
              className="rounded-md bg-blue-600 px-3 py-1 font-medium text-white hover:bg-blue-700"
            >
              Apply role
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="rounded-md bg-gray-100 px-3 py-1 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:bg-gray-900 dark:text-gray-300">
            <tr>
              <th className="w-8 px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={filtered.length > 0 && filtered.every((u) => selected.has(u.id))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelected(new Set(filtered.map((u) => u.id)))
                    } else {
                      setSelected(new Set())
                    }
                  }}
                />
              </th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Last login</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j} className="px-3 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                  No users match.
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  isSelf={u.id === me.id}
                  selected={selected.has(u.id)}
                  onToggle={() => toggleSelected(u.id)}
                  onRoleChange={(role) => updateUser.mutate({ userId: u.id, role })}
                  onActiveChange={(is_active) =>
                    updateUser.mutate({ userId: u.id, is_active })
                  }
                  onApprove={() => {
                    approveUser.mutate(u.id, {
                      onSuccess: () => toast.success(`${u.display_name} approved`),
                    })
                  }}
                  onRevoke={async () => {
                    const ok = await confirmDialog({
                      title: `Revoke sessions for ${u.display_name}?`,
                      body: 'They will be signed out of every device. They can sign back in if their account is still active.',
                      confirmLabel: 'Revoke sessions',
                      danger: true,
                    })
                    if (!ok) return
                    revokeSessions.mutate(u.id, {
                      onSuccess: () => toast.success('Sessions revoked'),
                    })
                  }}
                  onDelete={async () => {
                    const ok = await confirmDialog({
                      title: `Delete ${u.display_name}?`,
                      body: `${u.email} — this cannot be undone. Boards and cards they created will stay, but their account, comments, and assignments will be removed.`,
                      confirmLabel: 'Delete user',
                      danger: true,
                    })
                    if (!ok) return
                    deleteUser.mutate(u.id, {
                      onSuccess: () => toast.success('User deleted'),
                    })
                  }}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}

function UserRow({
  user,
  isSelf,
  selected,
  onToggle,
  onRoleChange,
  onActiveChange,
  onApprove,
  onRevoke,
  onDelete,
}: {
  user: AdminUser
  isSelf: boolean
  selected: boolean
  onToggle: () => void
  onRoleChange: (role: string) => void
  onActiveChange: (is_active: boolean) => void
  onApprove: () => void
  onRevoke: () => void
  onDelete: () => void
}) {
  const pending = !user.approved_at
  return (
    <tr
      className={
        pending
          ? 'bg-amber-50/50 dark:bg-amber-900/10'
          : user.is_active
            ? ''
            : 'opacity-60'
      }
    >
      <td className="px-3 py-2">
        <input
          type="checkbox"
          aria-label={`Select ${user.display_name}`}
          checked={selected}
          onChange={onToggle}
        />
      </td>
      <td className="px-3 py-2">
        <div className="font-medium text-gray-900 dark:text-gray-100">
          {user.display_name}
          {isSelf && (
            <span className="ml-2 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-blue-700">
              you
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500">@{user.username}</div>
      </td>
      <td className="px-3 py-2 text-gray-700 dark:text-gray-200">
        {user.email}
        {user.external_provider && (
          <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            {user.external_provider}
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        <select
          value={user.role}
          onChange={(e) => onRoleChange(e.target.value)}
          aria-label={`Role for ${user.display_name}`}
          className="rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700"
        >
          {ROLES.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 text-xs">
        {pending ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
            pending
          </span>
        ) : user.is_active ? (
          <span className="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-700">
            active
          </span>
        ) : (
          <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700">
            deactivated
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-gray-500">
        {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : '—'}
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1">
          {pending && (
            <button
              onClick={onApprove}
              className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700"
            >
              <UserCheck className="h-3 w-3" />
              Approve
            </button>
          )}
          {!pending &&
            (user.is_active ? (
              <button
                onClick={() => onActiveChange(false)}
                disabled={isSelf}
                className="rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                title={isSelf ? "You can't deactivate your own account" : undefined}
              >
                Deactivate
              </button>
            ) : (
              <button
                onClick={() => onActiveChange(true)}
                className="rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
              >
                Reactivate
              </button>
            ))}
          <button
            onClick={onRevoke}
            className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200"
          >
            Revoke sessions
          </button>
          <button
            onClick={onDelete}
            disabled={isSelf}
            aria-label={`Delete ${user.display_name}`}
            title={isSelf ? "You can't delete your own account" : 'Delete user permanently'}
            className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </button>
        </div>
      </td>
    </tr>
  )
}
