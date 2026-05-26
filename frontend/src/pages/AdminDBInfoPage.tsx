import { Navigate } from 'react-router-dom'
import { Database, Lock, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useDBInfo } from '@/api/dbInfo'
import { useMe } from '@/api/users'
import Skeleton from '@/components/ui/Skeleton'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export default function AdminDBInfoPage() {
  useDocumentTitle('Database')
  const { data: me, isLoading: meLoading } = useMe()
  const { data: info, isLoading, error } = useDBInfo()

  if (meLoading) {
    return <div className="p-6 text-sm text-gray-500">Loading…</div>
  }
  if (!me || me.role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-gray-100">
          <Database className="h-5 w-5" />
          Database
        </h1>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Live snapshot of the bound Postgres — version, extensions, and at-rest encryption
          (TDE) status.
        </p>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20" rounded="lg" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          Could not load database info.
        </div>
      )}

      {info && (
        <>
          <Status info={info} />

          <Section title="Postgres version">
            <code className="block break-all rounded bg-gray-100 px-2 py-1.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200">
              {info.postgres_version || '(unknown)'}
            </code>
          </Section>

          <Section title="Encrypted table access methods">
            {info.encrypted_access_methods.length === 0 ? (
              <p className="text-xs text-gray-500">
                No encrypted table access methods registered.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {info.encrypted_access_methods.map((am) => (
                  <li
                    key={am}
                    className="rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-xs text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                  >
                    {am}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={`Application tables (public schema, ${info.table_sample.length})`}>
            <div className="overflow-hidden rounded-md border border-gray-200 dark:border-gray-700">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 text-left text-[10px] uppercase tracking-wider text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  <tr>
                    <th className="px-3 py-1.5">Table</th>
                    <th className="px-3 py-1.5">Access method</th>
                    <th className="px-3 py-1.5">Encrypted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {info.table_sample.map((t) => (
                    <tr key={t.table}>
                      <td className="px-3 py-1 font-mono text-gray-800 dark:text-gray-200">
                        {t.table}
                      </td>
                      <td className="px-3 py-1 font-mono text-gray-500">{t.access_method}</td>
                      <td className="px-3 py-1">
                        {t.encrypted ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                            <Lock className="h-3 w-3" />
                            yes
                          </span>
                        ) : (
                          <span className="text-gray-500">no</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title={`Installed extensions (${info.installed_extensions.length})`}>
            <ul className="flex flex-wrap gap-1.5">
              {info.installed_extensions.map((e) => (
                <li
                  key={e.name}
                  className="rounded-full bg-gray-100 px-2 py-0.5 font-mono text-[11px] text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                >
                  {e.name}@{e.version}
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}
    </div>
  )
}

function Status({ info }: { info: ReturnType<typeof useDBInfo>['data'] & {} }) {
  // Three states worth distinguishing:
  //   1. pg_tde installed + tables on encrypted AM → fully covered
  //   2. pg_tde installed but tables on plain heap  → TDE wired but
  //      app data isn't using it (heap was set before extension, or
  //      no migration has switched it)
  //   3. pg_tde not installed                       → no TDE at the app
  //      data layer; trust depends on volume-level encryption only.
  const fully = info.tde_installed && info.tables_encrypted > 0 && info.tables_unencrypted === 0
  const partial = info.tde_installed && info.tables_encrypted > 0 && info.tables_unencrypted > 0
  const installedButUnused = info.tde_installed && info.tables_encrypted === 0
  const notInstalled = !info.tde_installed

  let icon: React.ReactNode = null
  let title = ''
  let body: React.ReactNode = null
  let tone = ''

  if (fully) {
    icon = <ShieldCheck className="h-5 w-5" />
    title = 'TDE is active for all application tables'
    tone =
      'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-100'
    body = (
      <p className="text-xs">
        Every public-schema table uses an encrypted access method ({info.encrypted_access_methods.join(', ') || 'tde_heap'}).
        Data files on disk and backups are encrypted at rest by Postgres itself.
      </p>
    )
  } else if (partial) {
    icon = <ShieldAlert className="h-5 w-5" />
    title = 'TDE is partially active'
    tone =
      'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100'
    body = (
      <p className="text-xs">
        {info.tables_encrypted} of {info.tables_encrypted + info.tables_unencrypted} tables are on
        an encrypted access method. The rest are on plain heap and rely on volume-level
        encryption only. Convert them with{' '}
        <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/50">ALTER TABLE … SET ACCESS METHOD tde_heap;</code>
      </p>
    )
  } else if (installedButUnused) {
    icon = <ShieldAlert className="h-5 w-5" />
    title = 'pg_tde is installed but no tables are using it'
    tone =
      'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100'
    body = (
      <p className="text-xs">
        The encryption extension is present but the application tables still use plain heap. A
        DBA can move them with{' '}
        <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/50">ALTER TABLE … SET ACCESS METHOD tde_heap;</code>{' '}
        — or rerun migrations against a fresh DB with the encrypted AM as the default.
      </p>
    )
  } else if (notInstalled) {
    icon = <ShieldAlert className="h-5 w-5" />
    title = info.tde_available ? 'TDE available but not installed' : 'No application-layer TDE'
    tone =
      'border-gray-300 bg-gray-50 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100'
    body = (
      <p className="text-xs">
        {info.tde_available
          ? "pg_tde is available on this Postgres but the extension isn't installed. Ask your platform / DBA to enable it on the northstar-db instance."
          : 'This Postgres tile does not ship pg_tde. Data-at-rest protection comes from the underlying volume encryption — confirm with your platform team that storage encryption is on.'}
      </p>
    )
  }

  return (
    <div className={`flex items-start gap-3 rounded-lg border p-3 ${tone}`}>
      <span className="mt-0.5">{icon}</span>
      <div className="flex-1">
        <div className="font-semibold">{title}</div>
        {body}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {title}
      </h2>
      {children}
    </section>
  )
}
