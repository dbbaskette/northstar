import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Star } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

type Mode = 'login' | 'register'

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const login = useAuthStore((s) => s.login)
  const register = useAuthStore((s) => s.register)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        if (password.length < 8) {
          setError('Password must be at least 8 characters')
          setLoading(false)
          return
        }
        await register(email, username, password, displayName)
      }
      navigate('/dashboard')
    } catch (err: unknown) {
      console.error('auth error:', err)
      const e = err as {
        response?: { status?: number; statusText?: string; data?: { error?: string } | string }
        message?: string
        code?: string
      }
      let msg: string
      if (e.code === 'ERR_NETWORK' || !e.response) {
        msg = 'Cannot reach the backend. Is it running? Try `./start.sh` from the project root.'
      } else if (typeof e.response.data === 'object' && e.response.data?.error) {
        msg = e.response.data.error
      } else if (e.response.status === 404) {
        msg = 'Backend route not found (is the backend running and up to date?)'
      } else {
        msg = `Request failed: ${e.response.status} ${e.response.statusText}`
      }
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login')
    setError('')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg dark:bg-gray-800 dark:shadow-2xl">
        <div className="mb-8 flex items-center justify-center gap-2">
          <Star className="h-8 w-8 text-blue-500" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Northstar</h1>
        </div>

        <h2 className="mb-6 text-center text-lg font-semibold text-gray-700 dark:text-gray-300">
          {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
              required
              autoComplete="email"
            />
          </div>

          {mode === 'register' && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
                  required
                  minLength={3}
                  autoComplete="username"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
                  required
                  autoComplete="name"
                />
              </div>
            </>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Password {mode === 'register' && <span className="text-xs text-gray-500">(8+ characters)</span>}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
              required
              minLength={mode === 'register' ? 8 : undefined}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading
              ? mode === 'login' ? 'Signing in...' : 'Creating account...'
              : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={switchMode}
            className="font-medium text-blue-600 hover:text-blue-700"
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}
