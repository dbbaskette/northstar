import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Plug, Trash2 } from 'lucide-react'
import { useMe } from '@/api/users'
import { usePlugins, useRegisterPlugin, useUnregisterPlugin } from '@/api/plugins'
import { confirmDialog } from '@/components/ui/ConfirmDialog'
import { toast } from '@/lib/toast'

export default function AdminPluginsPage() {
  const { data: me, isLoading: meLoading } = useMe()
  const { data: plugins = [], isLoading } = usePlugins()
  const register = useRegisterPlugin()
  const unregister = useUnregisterPlugin()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [iframeURL, setIframeURL] = useState('')
  const [manifestURL, setManifestURL] = useState('')
  const [version, setVersion] = useState('1.0.0')
  const [error, setError] = useState('')

  if (meLoading) return <div className="p-6 text-sm text-gray-500">Loading…</div>
  if (!me || me.role !== 'admin') return <Navigate to="/dashboard" replace />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await register.mutateAsync({
        name,
        description,
        iframe_url: iframeURL,
        manifest_url: manifestURL,
        version,
        capabilities: [],
      })
      setName('')
      setDescription('')
      setIframeURL('')
      setManifestURL('')
      setVersion('1.0.0')
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e.response?.data?.error || 'Failed to register plugin')
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Plugins</h1>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Register external plugins (iframe-based) once here, then board admins enable them
          per-board from the Share modal.
        </p>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
          Register plugin
        </h2>
        {error && <div className="mb-2 text-xs text-red-600">{error}</div>}
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700"
            />
          </Field>
          <Field label="Version">
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700"
            />
          </Field>
          <Field label="Iframe URL" full>
            <input
              type="url"
              value={iframeURL}
              onChange={(e) => setIframeURL(e.target.value)}
              required
              placeholder="https://plugin.example.com/embed"
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700"
            />
          </Field>
          <Field label="Manifest URL (optional)" full>
            <input
              type="url"
              value={manifestURL}
              onChange={(e) => setManifestURL(e.target.value)}
              placeholder="https://plugin.example.com/manifest.json"
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700"
            />
          </Field>
          <Field label="Description" full>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700"
            />
          </Field>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={register.isPending}
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Register
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <h2 className="border-b border-gray-200 p-4 text-sm font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200">
          Registered plugins
        </h2>
        {isLoading ? (
          <div className="p-4 text-xs text-gray-500">Loading…</div>
        ) : plugins.length === 0 ? (
          <div className="flex items-center gap-2 p-4 text-xs text-gray-500">
            <Plug className="h-4 w-4" />
            No plugins registered yet.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {plugins.map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-3 p-4 text-sm">
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {p.name} <span className="text-xs text-gray-500">v{p.version}</span>
                  </div>
                  {p.description && (
                    <div className="mt-0.5 text-xs text-gray-500">{p.description}</div>
                  )}
                  <div className="mt-1 break-all text-[11px] text-gray-400">
                    iframe: {p.iframe_url}
                  </div>
                </div>
                <button
                  onClick={async () => {
                    const ok = await confirmDialog({
                      title: `Unregister "${p.name}"?`,
                      body: 'This disables the plugin on every board.',
                      confirmLabel: 'Unregister',
                      danger: true,
                    })
                    if (!ok) return
                    unregister.mutate(p.id, {
                      onSuccess: () => toast.success('Plugin unregistered'),
                    })
                  }}
                  className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  aria-label={`Unregister ${p.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Field({
  label,
  children,
  full,
}: {
  label: string
  children: React.ReactNode
  full?: boolean
}) {
  return (
    <label className={`block text-xs ${full ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1 block font-semibold text-gray-600 dark:text-gray-300">{label}</span>
      {children}
    </label>
  )
}
