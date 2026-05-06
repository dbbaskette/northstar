import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Star, Github } from 'lucide-react'
import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'

type Mode = 'login' | 'register'

interface SSOProviders {
  github?: boolean
}

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [providers, setProviders] = useState<SSOProviders>({})
  const [needTOTP, setNeedTOTP] = useState(false)
  const [totpCode, setTotpCode] = useState('')
  const [pending, setPending] = useState(false)
  const login = useAuthStore((s) => s.login)
  const register = useAuthStore((s) => s.register)
  const hydrate = useAuthStore((s) => s.hydrateFromTokens)
  const navigate = useNavigate()
  const location = useLocation()

  // Surface backend ?error=... or ?pending=1 query string set by the
  // SSO callback (server-side redirects use these to pass status to
  // the SPA without a stateful session).
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const e = params.get('error')
    if (e) setError(decodeURIComponent(e))
    if (params.get('pending') === '1') setPending(true)
  }, [location.search])

  // Capture tokens that arrive in the URL fragment after an SSO redirect.
  useEffect(() => {
    if (!location.hash || !location.hash.includes('access_token=')) return
    const hash = new URLSearchParams(location.hash.replace(/^#/, ''))
    const access = hash.get('access_token')
    const refresh = hash.get('refresh_token') || undefined
    const returnTo = hash.get('return_to') || '/dashboard'
    if (!access) return
    ;(async () => {
      try {
        await hydrate(access, refresh)
        // Clear the fragment before navigating so refreshing doesn't replay it.
        window.history.replaceState({}, '', '/login')
        navigate(returnTo, { replace: true })
      } catch (err) {
        console.error('SSO hydrate failed', err)
        setError('Could not complete SSO sign-in.')
      }
    })()
  }, [location.hash, hydrate, navigate])

  useEffect(() => {
    axios
      .get('/api/v1/auth/sso/providers')
      .then((res) => setProviders(res.data || {}))
      .catch(() => setProviders({}))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        const result = await login(email, password, totpCode || undefined)
        if (result && 'twoFactorRequired' in result) {
          setNeedTOTP(true)
          setError('Enter the code from your authenticator app to continue.')
          setLoading(false)
          return
        }
        if (result && 'pendingApproval' in result) {
          setPending(true)
          setLoading(false)
          return
        }
      } else {
        if (password.length < 8) {
          setError('Password must be at least 8 characters')
          setLoading(false)
          return
        }
        const result = await register(email, username, password, displayName)
        if (result && 'pendingApproval' in result) {
          setPending(true)
          setLoading(false)
          return
        }
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

  const ssoEnabled = providers.github

  if (pending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100 p-4 dark:from-gray-900 dark:to-gray-800">
        <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-lg dark:bg-gray-800">
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-amber-100 p-3 dark:bg-amber-900/40">
              <Star className="h-8 w-8 text-amber-600" />
            </div>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Waiting on an admin
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Your account has been created and is pending admin approval. You'll be able to
            sign in once an admin approves it.
          </p>
          <button
            onClick={() => {
              setPending(false)
              setError('')
              setNeedTOTP(false)
              setTotpCode('')
            }}
            className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Back to sign in
          </button>
        </div>
      </div>
    )
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

        {ssoEnabled && (
          <div className="mb-6 space-y-2">
            {providers.github && (
              <a
                href="/api/v1/auth/github/start?return_to=/dashboard"
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
              >
                <Github className="h-4 w-4" />
                Continue with GitHub
              </a>
            )}
            <div className="relative my-3 text-center text-xs text-gray-500">
              <span className="absolute left-0 top-1/2 h-px w-full bg-gray-200 dark:bg-gray-700" />
              <span className="relative bg-white px-2 dark:bg-gray-800">or</span>
            </div>
          </div>
        )}

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

          {mode === 'login' && needTOTP && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Authenticator code
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                autoFocus
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-center font-mono text-lg tracking-widest focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                required
              />
            </div>
          )}

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
