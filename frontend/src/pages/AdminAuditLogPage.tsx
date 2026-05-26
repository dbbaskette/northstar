import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Download, RefreshCw } from 'lucide-react'
import { auditCSVURL, useAuditLog, type AuditFilter } from '@/api/audit'
import { useMe } from '@/api/users'
import Skeleton from '@/components/ui/Skeleton'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function isoFromInput(v: string, end: boolean): string | undefined {
  if (!v) return undefined
  const t = end ? `${v}T23:59:59Z` : `${v}T00:00:00Z`
  return t
}

export default function AdminAuditLogPage() {
  useDocumentTitle('Audit log')
  const { data: me, isLoading: meLoading } = useMe()
  const [actor, setActor] = useState('')
  const [action, setAction] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState(todayISO())

  const filter: AuditFilter = useMemo(
    () => ({
      actor: actor || undefined,
      action: action || undefined,
      from: isoFromInput(fromDate, false),
      to: isoFromInput(toDate, true),
      limit: 200,
    }),
    [actor, action, fromDate, toDate],
  )

  const { data, isLoading, refetch, isFetching } = useAuditLog(filter)

  if (meLoading) {
    return <div className="p-6 text-sm text-gray-500">Loading…</div>
  }
  if (!me || me.role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  const entries = data?.entries || []
  const actions = data?.actions || []

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Audit log</h1>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Append-only record of security-relevant events: logins, role changes, board
            visibility, member changes, deletions.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            aria-label="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <a
            href={auditCSVURL(filter)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            download
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-4 dark:border-gray-700 dark:bg-gray-800">
        <FilterField label="Actor user ID">
          <input
            type="text"
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            placeholder="UUID (optional)"
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700"
          />
        </FilterField>
        <FilterField label="Action">
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700"
          >
            <option value="">Any</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="From">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700"
          />
        </FilterField>
        <FilterField label="To">
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700"
          />
        </FilterField>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:bg-gray-900 dark:text-gray-300">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Target</th>
              <th className="px-3 py-2">IP</th>
              <th className="px-3 py-2">Metadata</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j} className="px-3 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                  No events match the current filters.
                </td>
              </tr>
            ) : (
              entries.map((e, i) => (
                <tr key={i} className="text-gray-700 dark:text-gray-200">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">
                    {new Date(e.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    {e.actor_name ? (
                      <div>
                        <div className="font-medium">{e.actor_name}</div>
                        <div className="text-xs text-gray-500">{e.actor_email}</div>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">(anonymous)</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{e.action}</td>
                  <td className="px-3 py-2 text-xs">
                    {e.target_type && (
                      <>
                        <span className="text-gray-500">{e.target_type}</span>
                        {e.target_id && (
                          <span className="ml-1 font-mono">{shortID(e.target_id)}</span>
                        )}
                      </>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">{e.ip}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {e.metadata ? <code>{prettyMeta(e.metadata)}</code> : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-semibold text-gray-600 dark:text-gray-300">{label}</span>
      {children}
    </label>
  )
}

function shortID(s: string): string {
  return s.length > 12 ? s.slice(0, 8) + '…' : s
}

function prettyMeta(raw: unknown): string {
  try {
    if (typeof raw !== 'string') return JSON.stringify(raw)
    const parsed = JSON.parse(raw)
    return JSON.stringify(parsed)
  } catch {
    return String(raw)
  }
}
