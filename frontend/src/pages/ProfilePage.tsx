import { useEffect, useRef, useState } from 'react'
import { Camera, Save } from 'lucide-react'
import { useMe, useUpdateProfile, useUploadAvatar } from '@/api/users'
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
    </div>
  )
}
