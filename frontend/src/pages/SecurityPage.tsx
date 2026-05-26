import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, Smartphone, Monitor, RefreshCw, KeyRound, Bell } from 'lucide-react'
import {
  useNotifPrefs,
  useRevokeSession,
  useSessions,
  useSetNotifPrefs,
  useTwoFADisable,
  useTwoFASetup,
  useTwoFAStatus,
  useTwoFAVerify,
} from '@/api/security'
import { toast } from '@/lib/toast'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

function shortUA(ua: string): string {
  if (!ua) return 'Unknown device'
  if (/iPhone|iPad/i.test(ua)) return 'iOS device'
  if (/Android/i.test(ua)) return 'Android device'
  if (/Edg\//.test(ua)) return 'Edge'
  if (/Chrome\//.test(ua)) return 'Chrome'
  if (/Firefox\//.test(ua)) return 'Firefox'
  if (/Safari\//.test(ua)) return 'Safari'
  return ua.slice(0, 60)
}

export default function SecurityPage() {
  useDocumentTitle('Security')
  const { data: sessions = [], isLoading } = useSessions()
  const revoke = useRevokeSession()
  const { data: twoFA } = useTwoFAStatus()
  const setup = useTwoFASetup()
  const verify = useTwoFAVerify()
  const disable = useTwoFADisable()

  const [pending, setPending] = useState<{ otpauth_url: string; secret: string } | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  const startSetup = async () => {
    setError('')
    const data = await setup.mutateAsync()
    setPending(data)
  }

  const finishSetup = async () => {
    setError('')
    try {
      await verify.mutateAsync(code)
      setPending(null)
      setCode('')
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e.response?.data?.error || 'Invalid code')
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Security</h1>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Manage your active sessions and two-factor authentication.
        </p>
      </div>

      {/* Notifications */}
      <NotificationPrefs />

      {/* Password */}
      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
          <KeyRound className="h-4 w-4" />
          Password
        </h2>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Pick a new password. Doing this signs other sessions out.
          </p>
          <Link
            to="/change-password"
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            Change password
          </Link>
        </div>
      </section>

      {/* 2FA */}
      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
          <ShieldCheck className="h-4 w-4" />
          Two-factor authentication
        </h2>

        {twoFA?.enabled ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              2FA is <span className="font-semibold text-green-600">enabled</span>. You'll be
              prompted for a code each time you sign in.
            </p>
            <button
              onClick={() => disable.mutate()}
              className="rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
            >
              Disable
            </button>
          </div>
        ) : pending ? (
          <div className="space-y-3">
            <p className="text-xs text-gray-600 dark:text-gray-300">
              Scan this URL with an authenticator app (1Password, Google Authenticator, Authy),
              then enter the 6-digit code it shows.
            </p>
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 font-mono text-xs break-all dark:border-gray-700 dark:bg-gray-900">
              {pending.otpauth_url}
            </div>
            <p className="text-xs text-gray-500">
              Or enter this secret manually:{' '}
              <code className="rounded bg-gray-100 px-1 py-0.5 dark:bg-gray-700">
                {pending.secret}
              </code>
            </p>
            {error && <div className="text-xs text-red-600">{error}</div>}
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="6-digit code"
                aria-label="6-digit verification code"
                className="w-32 rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700"
              />
              <button
                onClick={finishSetup}
                disabled={code.length !== 6}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Enable 2FA
              </button>
              <button
                onClick={() => {
                  setPending(null)
                  setCode('')
                }}
                className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              2FA is not enabled. Add an authenticator app for stronger account security.
            </p>
            <button
              onClick={startSetup}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              Set up 2FA
            </button>
          </div>
        )}
      </section>

      {/* Sessions */}
      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
          <Monitor className="h-4 w-4" />
          Active sessions
        </h2>

        {isLoading ? (
          <div className="text-xs text-gray-500">Loading…</div>
        ) : sessions.length === 0 ? (
          <div className="text-xs text-gray-500">No active sessions found.</div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-gray-400" />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {shortUA(s.user_agent)}
                      {s.is_current && (
                        <span className="ml-2 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-green-700">
                          this session
                        </span>
                      )}
                      {s.revoked_at && (
                        <span className="ml-2 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                          revoked
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {s.ip} · last active{' '}
                      {new Date(s.last_seen_at).toLocaleString()} · started{' '}
                      {new Date(s.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                {!s.revoked_at && !s.is_current && (
                  <button
                    onClick={() => revoke.mutate(s.id)}
                    className="rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                  >
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 flex items-center gap-1 text-[11px] text-gray-500">
          <RefreshCw className="h-3 w-3" />
          Revoking a session immediately invalidates its access tokens.
        </p>
      </section>
    </div>
  )
}

const NOTIF_TYPES: { id: string; label: string; help: string }[] = [
  {
    id: 'mention',
    label: 'Mentions',
    help: 'Someone @-mentions you in a comment or description.',
  },
  {
    id: 'card.assigned',
    label: 'Card assignments',
    help: 'You get assigned to a card.',
  },
  {
    id: 'comment.added',
    label: 'Comments on cards you watch',
    help: "New comment on a card you're watching.",
  },
  {
    id: 'reminder',
    label: 'Card reminders',
    help: 'Reminders you set on cards (e.g. "ping me 1 day before due").',
  },
]

function NotificationPrefs() {
  const { data: prefs = {}, isLoading } = useNotifPrefs()
  const setPrefs = useSetNotifPrefs()

  // Default: undefined means "on." Explicit false means "off."
  const isEnabled = (type: string): boolean => prefs[type] !== false

  const toggle = async (type: string) => {
    const next = { ...prefs }
    if (next[type] === false) delete next[type]
    else next[type] = false
    try {
      await setPrefs.mutateAsync(next)
      toast.success('Preference updated')
    } catch {
      toast.error('Could not save')
    }
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
        <Bell className="h-4 w-4" />
        Notifications
      </h2>
      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
        Pick what pings the bell in the header. Off here means we never create the notification,
        not just hide it.
      </p>
      {isLoading ? (
        <div className="text-xs text-gray-400">Loading…</div>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {NOTIF_TYPES.map((t) => {
            const on = isEnabled(t.id)
            return (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {t.label}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{t.help}</div>
                </div>
                <button
                  role="switch"
                  aria-checked={on}
                  aria-label={`Toggle ${t.label}`}
                  onClick={() => toggle(t.id)}
                  disabled={setPrefs.isPending}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition disabled:opacity-50 ${
                    on ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition ${
                      on ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
