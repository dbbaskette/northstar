import { useState } from 'react'
import { useBoardReports, type CountByName, type TrendPoint } from '@/api/reports'

interface Props {
  boardId: string
}

const RANGES = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
] as const

export default function BoardReportsView({ boardId }: Props) {
  const [days, setDays] = useState(30)
  const { data, isLoading } = useBoardReports(boardId, days)

  if (isLoading || !data) {
    return (
      <div className="flex h-full items-center justify-center bg-white/95 p-6 text-sm text-gray-600 dark:bg-gray-900/90">
        Loading reports…
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto bg-gray-50/95 p-6 dark:bg-gray-900/90">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Reports</h2>
        <div className="flex gap-1 rounded-md bg-white p-0.5 shadow-sm dark:bg-gray-800">
          {RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setDays(r.days)}
              className={`rounded px-3 py-1 text-xs font-medium ${
                days === r.days
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Stat label="Open cards" value={data.open_count} />
        <Stat label="Completed" value={data.completed_count} accent="green" />
        <Stat label="Overdue" value={data.overdue_count} accent="red" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Cards per list">
          <BarList data={data.cards_by_list} />
        </Card>
        <Card title="Cards by priority">
          <BarList
            data={data.cards_by_priority}
            colorFor={(name) =>
              ({
                urgent: '#DC2626',
                high: '#F59E0B',
                medium: '#3B82F6',
                low: '#10B981',
                none: '#6B7280',
              }[name] || '#6B7280')
            }
          />
        </Card>
        <Card title="Top assignees">
          {data.cards_by_member.length === 0 ? (
            <Empty msg="No assignees yet." />
          ) : (
            <BarList data={data.cards_by_member} />
          )}
        </Card>
        <Card title={`Completion trend (last ${days} days)`}>
          <TrendChart points={data.completion_trend} />
        </Card>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent?: 'green' | 'red'
}) {
  const tone =
    accent === 'green'
      ? 'text-green-700 dark:text-green-400'
      : accent === 'red'
        ? 'text-red-700 dark:text-red-400'
        : 'text-gray-900 dark:text-gray-100'
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {label}
      </div>
      <div className={`mt-1 text-3xl font-bold ${tone}`}>{value}</div>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">{title}</h3>
      {children}
    </div>
  )
}

function Empty({ msg }: { msg: string }) {
  return <div className="py-6 text-center text-xs text-gray-500">{msg}</div>
}

function BarList({
  data,
  colorFor,
}: {
  data: CountByName[]
  colorFor?: (name: string) => string
}) {
  if (data.length === 0) return <Empty msg="No data yet." />
  const max = Math.max(...data.map((d) => d.count), 1)
  return (
    <div className="space-y-1.5">
      {data.map((d, i) => (
        <div key={(d.id ?? '') + i} className="flex items-center gap-2 text-xs">
          <div className="w-32 truncate text-gray-700 dark:text-gray-200" title={d.name}>
            {d.name}
          </div>
          <div className="relative flex-1 overflow-hidden rounded bg-gray-100 dark:bg-gray-700">
            <div
              className="h-5 rounded transition-all"
              style={{
                width: `${(d.count / max) * 100}%`,
                backgroundColor: colorFor ? colorFor(d.name) : '#3B82F6',
                minWidth: d.count > 0 ? 2 : 0,
              }}
            />
          </div>
          <div className="w-8 text-right tabular-nums text-gray-600 dark:text-gray-300">
            {d.count}
          </div>
        </div>
      ))}
    </div>
  )
}

function TrendChart({ points }: { points: TrendPoint[] }) {
  if (points.length === 0) return <Empty msg="No data yet." />
  const max = Math.max(...points.flatMap((p) => [p.completed, p.created]), 1)
  const w = 600
  const h = 120
  const stepX = points.length > 1 ? w / (points.length - 1) : w
  const path = (key: 'completed' | 'created') =>
    points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${i * stepX},${h - (p[key] / max) * h}`)
      .join(' ')

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-32 w-full" role="img" aria-label="Completion trend">
        <line x1="0" y1={h} x2={w} y2={h} stroke="#E5E7EB" strokeWidth="1" />
        <path d={path('created')} fill="none" stroke="#9CA3AF" strokeWidth="2" strokeDasharray="4 4" />
        <path d={path('completed')} fill="none" stroke="#10B981" strokeWidth="2" />
      </svg>
      <div className="flex gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 bg-emerald-500" /> completed
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3" style={{ background: 'repeating-linear-gradient(90deg, #9CA3AF 0 4px, transparent 4px 8px)' }} />
          created
        </span>
      </div>
    </div>
  )
}
