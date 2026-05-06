import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Star, Lock } from 'lucide-react'
import { useAcceptInvite, useInvitePreview } from '@/api/invites'
import { useAuthStore } from '@/stores/authStore'

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>()
  const { data: preview, isLoading, error } = useInvitePreview(token || null)
  const acceptInvite = useAcceptInvite()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const navigate = useNavigate()

  const [acceptError, setAcceptError] = useState('')

  useEffect(() => {
    if (!isAuthenticated && token) {
      sessionStorage.setItem('northstar:redirect-after-login', `/invites/${token}`)
    }
  }, [isAuthenticated, token])

  const handleAccept = async () => {
    if (!token) return
    setAcceptError('')
    try {
      const result = await acceptInvite.mutateAsync(token)
      navigate(`/boards/${result.board_id}`)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to accept invite'
      setAcceptError(msg)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg dark:bg-gray-800">
        <div className="mb-6 flex items-center justify-center gap-2">
          <Star className="h-6 w-6 text-blue-500" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Northstar</h1>
        </div>

        {isLoading && (
          <div className="text-center text-sm text-gray-500 dark:text-gray-400">Loading…</div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 p-4 text-center text-sm text-red-600 dark:bg-red-900/30 dark:text-red-300">
            This invite is invalid, expired, or has already been used.
          </div>
        )}

        {preview && (
          <>
            <div className="mb-6 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">You've been invited to join</p>
              <h2 className="mt-1 flex items-center justify-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
                <Lock className="h-5 w-5 text-gray-400" />
                {preview.board_name}
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                in <span className="font-medium">{preview.team_name}</span>
                {preview.inviter_name && <> · invited by {preview.inviter_name}</>}
              </p>
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                You'll join as a <span className="font-semibold capitalize">{preview.role}</span>.
              </p>
            </div>

            {acceptError && (
              <div className="mb-4 rounded-lg bg-red-50 p-2 text-xs text-red-600 dark:bg-red-900/30 dark:text-red-300">
                {acceptError}
              </div>
            )}

            {isAuthenticated ? (
              <button
                onClick={handleAccept}
                disabled={acceptInvite.isPending}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {acceptInvite.isPending ? 'Joining…' : 'Accept and join'}
              </button>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Sign in to accept
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
