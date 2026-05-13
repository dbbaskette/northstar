import { useEffect, useState } from 'react'
import { UserPlus, X, Copy, Check, AlertTriangle } from 'lucide-react'
import { useCreateUser, type AdminCreatedUser } from '@/api/adminUsers'
import { toast } from '@/lib/toast'

interface Props {
  open: boolean
  onClose: () => void
}

// Two-phase modal: form → result. The result phase shows the temp
// password exactly once (we never re-fetch it), with a copy button
// and an "I've shared it" close so admins can't lose it by clicking
// off accidentally.
export default function CreateUserModal({ open, onClose }: Props) {
  const create = useCreateUser()
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [role, setRole] = useState<'admin' | 'member' | 'viewer'>('member')
  const [error, setError] = useState('')
  const [result, setResult] = useState<AdminCreatedUser | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) {
      // Reset everything when the modal closes (so reopen is clean).
      setEmail('')
      setDisplayName('')
      setUsername('')
      setRole('member')
      setError('')
      setResult(null)
      setCopied(false)
    }
  }, [open])

  // Auto-suggest a username from the email — admin can edit before submit.
  useEffect(() => {
    if (username) return
    const before = email.split('@')[0] || ''
    if (before) setUsername(before.replace(/[^a-z0-9._-]/gi, ''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email])

  if (!open) return null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email.trim() || !displayName.trim() || !username.trim()) {
      setError('Email, display name, and username are required.')
      return
    }
    try {
      const r = await create.mutateAsync({
        email: email.trim(),
        display_name: displayName.trim(),
        username: username.trim(),
        role,
      })
      setResult(r)
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e.response?.data?.error || 'Could not create user')
    }
  }

  const copyPassword = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.temp_password)
      setCopied(true)
      toast.success('Temp password copied')
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Clipboard unavailable')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-20"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-user-title"
      // Only allow click-out to close when we're in the *form* phase.
      // After creation we want admins to confirm they've copied the password.
      onClick={() => !result && onClose()}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 p-6 dark:border-gray-700">
          <h2
            id="create-user-title"
            className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100"
          >
            <UserPlus className="h-4 w-4" />
            {result ? 'User created' : 'Create user'}
          </h2>
          {!result && (
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {result ? (
          <div className="space-y-4 p-6">
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
              <div className="mb-1 flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" />
                Copy the temp password now
              </div>
              <p className="text-xs">{result.warning}</p>
            </div>

            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Account
              </div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {result.user.display_name}{' '}
                <span className="text-xs font-normal text-gray-500">({result.user.email})</span>
              </div>
              <div className="mt-0.5 text-xs text-gray-500">
                @{result.user.username} · role {result.user.role}
              </div>
            </div>

            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Temporary password
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-sm tracking-wider text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
                  {result.temp_password}
                </code>
                <button
                  onClick={copyPassword}
                  className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="mt-2 text-[11px] text-gray-500">
                They'll be forced to set a new password the first time they sign in.
              </p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-black dark:bg-gray-700 dark:hover:bg-gray-600"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3 p-6">
            {error && (
              <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
                {error}
              </div>
            )}
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700"
              />
            </Field>
            <Field label="Display name">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700"
              />
            </Field>
            <Field label="Username">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                pattern="[a-zA-Z0-9._-]+"
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700"
              />
            </Field>
            <Field label="Role">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'admin' | 'member' | 'viewer')}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700"
              >
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              A temporary password is generated automatically. You'll see it once on the next
              screen — copy it and share with the user. They'll be required to set their own
              password on first sign-in.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={create.isPending}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {create.isPending ? 'Creating…' : 'Create user'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-semibold text-gray-600 dark:text-gray-300">{label}</span>
      {children}
    </label>
  )
}
