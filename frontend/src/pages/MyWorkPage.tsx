import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Eye,
  Inbox,
  AtSign,
  UserCheck,
  Star,
} from 'lucide-react'
import { useMyWork, type WorkItem, type WorkReason } from '@/api/work'
import EmptyState from '@/components/ui/EmptyState'
import Skeleton from '@/components/ui/Skeleton'
import CardHoverPreview, { useHoverPreview } from '@/components/ui/CardHoverPreview'

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#DC2626',
  high: '#F59E0B',
  medium: '#3B82F6',
  low: '#10B981',
}

type Bucket = 'overdue' | 'today' | 'week' | 'later' | 'no_date' | 'completed'

const BUCKET_LABEL: Record<Bucket, { title: string; tint: string; icon: React.ReactNode }> = {
  overdue: {
    title: 'Overdue',
    tint: 'border-red-200 bg-red-50/40 dark:border-red-900/60 dark:bg-red-900/10',
    icon: <AlertCircle className="h-4 w-4 text-red-600" />,
  },
  today: {
    title: 'Due today',
    tint: 'border-amber-200 bg-amber-50/40 dark:border-amber-900/60 dark:bg-amber-900/10',
    icon: <CalendarDays className="h-4 w-4 text-amber-600" />,
  },
  week: {
    title: 'Due this week',
    tint: 'border-blue-200 bg-blue-50/40 dark:border-blue-900/60 dark:bg-blue-900/10',
    icon: <CalendarDays className="h-4 w-4 text-blue-600" />,
  },
  later: {
    title: 'Due later',
    tint: 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800',
    icon: <CalendarDays className="h-4 w-4 text-gray-500" />,
  },
  no_date: {
    title: 'No due date',
    tint: 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800',
    icon: <Inbox className="h-4 w-4 text-gray-500" />,
  },
  completed: {
    title: 'Recently completed',
    tint: 'border-green-200 bg-green-50/30 dark:border-green-900/60 dark:bg-green-900/10',
    icon: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  },
}

function bucketFor(item: WorkItem): Bucket {
  if (item.completed_at) return 'completed'
  if (!item.due_date) return 'no_date'
  const due = new Date(item.due_date)
  const now = new Date()
  if (due < now) return 'overdue'
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  if (due <= today) return 'today'
  const oneWeekOut = new Date()
  oneWeekOut.setDate(oneWeekOut.getDate() + 7)
  if (due <= oneWeekOut) return 'week'
  return 'later'
}

const REASON_FILTERS: { id: 'all' | WorkReason; label: string; icon: React.ReactNode }[] = [
  { id: 'all', label: 'All', icon: <Star className="h-3.5 w-3.5" /> },
  { id: 'assigned', label: 'Assigned to me', icon: <UserCheck className="h-3.5 w-3.5" /> },
  { id: 'watching', label: 'Watching', icon: <Eye className="h-3.5 w-3.5" /> },
  { id: 'mentioned', label: 'Mentioned', icon: <AtSign className="h-3.5 w-3.5" /> },
]

export default function MyWorkPage() {
  const { data: items = [], isLoading } = useMyWork()
  const [filter, setFilter] = useState<'all' | WorkReason>('all')
  const preview = useHoverPreview()

  const filtered = useMemo(
    () =>
      filter === 'all' ? items : items.filter((i) => i.reasons.includes(filter)),
    [items, filter],
  )

  const grouped = useMemo(() => {
    const out: Record<Bucket, WorkItem[]> = {
      overdue: [],
      today: [],
      week: [],
      later: [],
      no_date: [],
      completed: [],
    }
    for (const it of filtered) {
      out[bucketFor(it)].push(it)
    }
    return out
  }, [filtered])

  const totals = {
    all: items.length,
    assigned: items.filter((i) => i.reasons.includes('assigned')).length,
    watching: items.filter((i) => i.reasons.includes('watching')).length,
    mentioned: items.filter((i) => i.reasons.includes('mentioned')).length,
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">My work</h1>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Cards you're assigned to, watching, or mentioned in — across every team and board.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 text-xs dark:border-gray-700 dark:bg-gray-800">
        {REASON_FILTERS.map((f) => {
          const count = totals[f.id]
          const active = filter === f.id
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition ${
                active
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {f.icon}
              {f.label}
              <span
                className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                  active
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16" rounded="lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Inbox zero — for now"
          description="Cards assigned to you, ones you're watching, and @-mentions land here. Open a board to start filling it."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Star}
          title="Nothing in this filter"
          description="Try a different tab above."
        />
      ) : (
        <div className="space-y-5">
          {(['overdue', 'today', 'week', 'later', 'no_date', 'completed'] as Bucket[]).map(
            (b) =>
              grouped[b].length > 0 && (
                <BucketSection key={b} bucket={b} items={grouped[b]} hoverProps={preview} />
              ),
          )}
        </div>
      )}
      <CardHoverPreview
        cardId={preview.state?.cardId || null}
        anchor={preview.state?.anchor || null}
        onClose={preview.close}
      />
    </div>
  )
}

type HoverProps = ReturnType<typeof useHoverPreview>

function BucketSection({
  bucket,
  items,
  hoverProps,
}: {
  bucket: Bucket
  items: WorkItem[]
  hoverProps: HoverProps
}) {
  const meta = BUCKET_LABEL[bucket]
  return (
    <section className={`overflow-hidden rounded-lg border ${meta.tint}`}>
      <header className="flex items-center justify-between border-b border-current/10 px-4 py-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
          {meta.icon}
          {meta.title}
        </div>
        <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-900/60 dark:text-gray-300">
          {items.length}
        </span>
      </header>
      <ul className="divide-y divide-gray-100 dark:divide-gray-700">
        {items.map((it) => (
          <WorkRow key={it.card_id} item={it} hoverProps={hoverProps} />
        ))}
      </ul>
    </section>
  )
}

function WorkRow({ item, hoverProps }: { item: WorkItem; hoverProps: HoverProps }) {
  const due = item.due_date ? new Date(item.due_date) : null
  const overdue = !!(due && !item.completed_at && due < new Date())
  return (
    <li>
      <Link
        to={`/boards/${item.board_id}?card=${item.card_id}`}
        onMouseEnter={(e) => hoverProps.show(item.card_id, e.currentTarget)}
        onMouseLeave={() => hoverProps.cancel()}
        className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/40"
      >
        {item.priority ? (
          <span
            className="h-7 w-1.5 flex-shrink-0 rounded-full"
            style={{ backgroundColor: PRIORITY_COLORS[item.priority] || '#9CA3AF' }}
            title={`Priority: ${item.priority}`}
          />
        ) : (
          <span className="h-7 w-1.5 flex-shrink-0 rounded-full bg-gray-200 dark:bg-gray-700" />
        )}
        <div className="min-w-0 flex-1">
          <div
            className={`truncate text-sm font-medium ${
              item.completed_at
                ? 'text-gray-500 line-through dark:text-gray-500'
                : 'text-gray-900 dark:text-gray-100'
            }`}
          >
            {item.title}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
            <span>
              {item.board_name} → {item.list_name}
            </span>
            {due && (
              <span
                className={`inline-flex items-center gap-1 ${
                  overdue ? 'text-red-600 dark:text-red-400' : ''
                }`}
              >
                <CalendarDays className="h-3 w-3" />
                {due.toLocaleDateString()}
              </span>
            )}
            {item.reasons.map((r) => (
              <span
                key={r}
                className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-1.5 py-0.5 font-medium uppercase tracking-wider text-[10px] text-gray-600 dark:bg-gray-700 dark:text-gray-300"
              >
                {r === 'assigned' ? (
                  <UserCheck className="h-3 w-3" />
                ) : r === 'watching' ? (
                  <Eye className="h-3 w-3" />
                ) : (
                  <AtSign className="h-3 w-3" />
                )}
                {r}
              </span>
            ))}
          </div>
        </div>
      </Link>
    </li>
  )
}
