import { useEffect, useRef, useState } from 'react'
import { Camera, Save, Key, Plus, Trash2, Copy, Check } from 'lucide-react'
import { useMe, useUpdateProfile, useUploadAvatar } from '@/api/users'
import {
  useAPITokens,
  useCreateAPIToken,
  useDeleteAPIToken,
} from '@/api/apiTokens'
import { useAuthStore } from '@/stores/authStore'
import Avatar from '@/components/ui/Avatar'

function flatString(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'object' && 'Valid' in v && (v as { Valid: boolean }).Valid) {
    return (v as { String?: string }).String ?? ''
  }
  return ''
}

export default function ProfilePage() {
  const { data: user, isLoading } = useMe()
  const updateProfile = useUpdateProfile()
  const uploadAvatar = useUploadAvatar()
  const setAuth = useAuthStore((s) => s.setAuth)
  const accessToken = useAuthStore((s) => s.accessToken)
  const fileInput = useRef<HTMLInputElement>(null)

  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [timezone, setTimezone] = useState('UTC')
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name)
      setBio(flatString(user.bio))
      setTimezone(flatString(user.timezone) || 'UTC')
    }
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const updated = await updateProfile.mutateAsync({
        display_name: displayName.trim(),
        bio,
        timezone,
      })
      // Sync the auth store header so the header re-renders the new name
      if (accessToken) {
        setAuth(accessToken, {
          id: updated.id,
          email: updated.email,
          username: updated.username,
          displayName: updated.display_name,
          role: updated.role,
        })
      }
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 2000)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to save'
      setError(msg)
      setStatus('error')
    }
  }

  const handleAvatarChange = async (file: File) => {
    setError('')
    try {
      const updated = await uploadAvatar.mutateAsync(file)
      if (accessToken) {
        setAuth(accessToken, {
          id: updated.id,
          email: updated.email,
          username: updated.username,
          displayName: updated.display_name,
          role: updated.role,
        })
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to upload avatar'
      setError(msg)
    }
  }

  if (isLoading || !user) {
    return <div className="p-6 text-sm text-gray-500 dark:text-gray-400">Loading…</div>
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">Profile</h1>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="mb-8 flex items-center gap-6">
        <Avatar user={user} size="xl" />
        <div className="flex flex-col gap-2">
          <button
            onClick={() => fileInput.current?.click()}
            disabled={uploadAvatar.isPending}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Camera className="h-4 w-4" />
            {uploadAvatar.isPending ? 'Uploading…' : 'Change avatar'}
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400">PNG, JPG, GIF. Max 5MB.</span>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleAvatarChange(f)
            e.target.value = ''
          }}
          className="hidden"
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Display name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Username
            </label>
            <input
              value={user.username}
              disabled
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Email
            </label>
            <input
              value={user.email}
              disabled
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Bio <span className="text-xs text-gray-400">(optional)</span>
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Timezone
          </label>
          <input
            type="text"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="e.g. America/New_York"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={updateProfile.isPending || !displayName.trim()}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {updateProfile.isPending ? 'Saving…' : 'Save changes'}
          </button>
          {status === 'saved' && (
            <span className="text-xs text-green-600 dark:text-green-400">Saved.</span>
          )}
        </div>
      </form>

      <hr className="my-8 border-gray-200 dark:border-gray-700" />
      <APITokens />
    </div>
  )
}

function APITokens() {
  const { data: tokens = [] } = useAPITokens()
  const createToken = useCreateAPIToken()
  const deleteToken = useDeleteAPIToken()

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [expiresIn, setExpiresIn] = useState(90)
  const [newPlain, setNewPlain] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const tok = await createToken.mutateAsync({ name: name.trim(), expires_in_days: expiresIn })
    setNewPlain(tok.token || null)
    setName('')
    setShowForm(false)
  }

  const copy = async () => {
    if (!newPlain) return
    try {
      await navigator.clipboard.writeText(newPlain)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
          <Key className="h-5 w-5" />
          Personal API tokens
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-3.5 w-3.5" />
            New token
          </button>
        )}
      </div>

      <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
        Use these for scripts and external integrations. They authenticate as you with the same
        permissions. Send as <code className="rounded bg-gray-100 px-1 dark:bg-gray-700">Authorization: Bearer ns_…</code>.
      </p>

      {newPlain && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-900/30">
          <div className="mb-1 text-xs font-semibold text-amber-800 dark:text-amber-200">
            Copy this token now — it will not be shown again.
          </div>
          <div className="flex gap-2">
            <input
              readOnly
              value={newPlain}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 rounded bg-white px-2 py-1 font-mono text-xs text-gray-800 dark:bg-gray-800 dark:text-gray-200"
            />
            <button
              onClick={copy}
              className="rounded p-1.5 text-gray-500 hover:bg-amber-100 dark:hover:bg-amber-800"
            >
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setNewPlain(null)}
              className="rounded px-2 py-1 text-xs text-amber-800 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-800"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700"
        >
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              Token name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. CI script"
              className="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              Expires in (days)
            </label>
            <input
              type="number"
              value={expiresIn}
              onChange={(e) => setExpiresIn(parseInt(e.target.value, 10) || 0)}
              min={0}
              className="w-24 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="rounded-lg px-3 py-1 text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
        </form>
      )}

      <div className="space-y-2">
        {tokens.map((t) => {
          const lastUsed =
            t.last_used_at && 'Valid' in t.last_used_at && t.last_used_at.Valid
              ? new Date(t.last_used_at.Time).toLocaleString()
              : 'never'
          const expires =
            t.expires_at && 'Valid' in t.expires_at && t.expires_at.Valid
              ? new Date(t.expires_at.Time).toLocaleDateString()
              : '—'
          return (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-700"
            >
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{t.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Last used: {lastUsed} · Expires: {expires}
                </div>
              </div>
              <button
                onClick={() => deleteToken.mutate(t.id)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-700"
                title="Revoke"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )
        })}
        {tokens.length === 0 && !newPlain && (
          <div className="text-xs text-gray-400">No tokens yet.</div>
        )}
      </div>
    </section>
  )
}
