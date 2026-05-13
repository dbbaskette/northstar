import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Lock, Star } from 'lucide-react'
import { useMe } from '@/api/users'
import { useChangePassword } from '@/api/security'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/lib/toast'

// Two modes:
//   - Forced (when /users/me reports must_change_password): no Cancel
//     button, no other routes available (AppShell redirects every
//     other path back here until they finish).
//   - Voluntary (from /security): Cancel returns to /security.
export default function ChangePasswordPage() {
  const { data: me, isLoading } = useMe()
  const change = useChangePassword()
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')

  if (isLoading) {
    return <div className="p-6 text-sm text-gray-500">Loading…</div>
  }
  // Not signed in at all — bounce.
  if (!me) return <Navigate to="/login" replace />

  const forced = !!me.must_change_password

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (next.length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }
    if (next !== confirm) {
      setError('New passwords do not match.')
      return
    }
    if (next === current) {
      setError('New password must be different from the current one.')
      return
    }
    try {
      await change.mutateAsync({ current_password: current, new_password: next })
      toast.success('Password updated')
      navigate(forced ? '/dashboard' : '/security', { replace: true })
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e.response?.data?.error || 'Could not change password')
    }
  }

  const Card = (
    <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg dark:bg-gray-800">
      <div className="mb-5 flex items-center gap-2">
        {forced ? (
          <Star className="h-5 w-5 text-amber-500" />
        ) : (
          <Lock className="h-5 w-5 text-blue-600" />
        )}
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {forced ? 'Set a new password' : 'Change password'}
        </h1>
      </div>

      {forced && (
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
          Welcome to Northstar! Your account was created with a temporary password — pick your
          own to continue.
        </p>
      )}

      <form onSubmit={submit} className="space-y-3">
        {error && (
          <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}
        <Field label={forced ? 'Temporary password' : 'Current password'}>
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
            autoFocus
            autoComplete="current-password"
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700"
          />
        </Field>
        <Field label="New password">
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700"
          />
        </Field>
        <Field label="Confirm new password">
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700"
          />
        </Field>
        <p className="text-[11px] text-gray-500">Use 8 or more characters.</p>

        <div className="flex justify-end gap-2 pt-1">
          {forced ? (
            <button
              type="button"
              onClick={() => {
                logout()
                navigate('/login', { replace: true })
              }}
              className="rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              Sign out
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/security')}
              className="rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={change.isPending}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {change.isPending ? 'Saving…' : 'Update password'}
          </button>
        </div>
      </form>
    </div>
  )

  if (forced) {
    // Render full-screen, outside the AppShell, so the user has
    // nowhere else to navigate from the chrome.
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100 p-4 dark:from-gray-900 dark:to-gray-800">
        {Card}
      </div>
    )
  }

  return <div className="mx-auto max-w-md p-6">{Card}</div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-semibold text-gray-600 dark:text-gray-300">{label}</span>
      {children}
    </label>
  )
}
