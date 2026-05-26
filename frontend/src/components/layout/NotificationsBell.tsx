import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, Settings } from 'lucide-react'
import {
  uuidFromBytes,
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useUnreadCount,
} from '@/api/notifications'

const TYPE_LABELS: Record<string, string> = {
  'card.assigned': 'Assigned to you',
  'comment.added': 'New comment',
  mention: 'You were mentioned',
  reminder: 'Card reminder',
}

interface FilterDef {
  id: 'all' | string
  label: string
  match: (type: string) => boolean
}

const FILTERS: FilterDef[] = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'mention', label: 'Mentions', match: (t) => t === 'mention' },
  { id: 'card.assigned', label: 'Assignments', match: (t) => t === 'card.assigned' },
  { id: 'comment.added', label: 'Comments', match: (t) => t === 'comment.added' },
]

// Bucket cutoff in ms from now.
const DAY = 24 * 60 * 60 * 1000

function bucketFor(createdAt: string): 'today' | 'week' | 'earlier' {
  const age = Date.now() - new Date(createdAt).getTime()
  if (age < DAY) return 'today'
  if (age < 7 * DAY) return 'week'
  return 'earlier'
}

const BUCKET_TITLE: Record<'today' | 'week' | 'earlier', string> = {
  today: 'Today',
  week: 'This week',
  earlier: 'Earlier',
}

export default function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<FilterDef['id']>('all')
  const { data: notifications = [] } = useNotifications()
  const { data: unread = 0 } = useUnreadCount()
  const markRead = useMarkRead()
  const markAllRead = useMarkAllRead()
  const navigate = useNavigate()

  const filtered = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter) || FILTERS[0]!
    return notifications.filter((n) => f.match(n.type))
  }, [notifications, filter])

  // Group by recency bucket while preserving server order within each bucket.
  const groups = useMemo(() => {
    const out: Record<'today' | 'week' | 'earlier', typeof filtered> = {
      today: [],
      week: [],
      earlier: [],
    }
    for (const n of filtered) out[bucketFor(n.created_at)].push(n)
    return out
  }, [filtered])

  const handleClick = (
    id: string,
    sourceBoardID: string | null,
    payload: Record<string, unknown>,
  ) => {
    markRead.mutate(id)
    const cardId = (payload as { card_id?: string }).card_id
    if (sourceBoardID && cardId) {
      navigate(`/boards/${sourceBoardID}?card=${cardId}`)
    } else if (sourceBoardID) {
      navigate(`/boards/${sourceBoardID}`)
    }
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
        title="Notifications"
        aria-label={`Notifications (${unread} unread)`}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-96 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2 dark:border-gray-700">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Notifications
              </span>
              <div className="flex items-center gap-3">
                {unread > 0 && (
                  <button
                    onClick={() => markAllRead.mutate()}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Mark all read
                  </button>
                )}
                <Link
                  to="/security"
                  onClick={() => setOpen(false)}
                  title="Notification preferences"
                  aria-label="Notification preferences"
                  className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  <Settings className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            <div className="flex flex-wrap gap-1 border-b border-gray-100 px-2 py-1.5 dark:border-gray-700">
              {FILTERS.map((f) => {
                const count =
                  f.id === 'all'
                    ? notifications.length
                    : notifications.filter((n) => f.match(n.type)).length
                const active = filter === f.id
                return (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id)}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition ${
                      active
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                    }`}
                  >
                    {f.label}
                    <span
                      className={`rounded-full px-1 text-[10px] tabular-nums ${
                        active
                          ? 'bg-white/20'
                          : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-400">
                  {filter === 'all' ? 'No notifications yet.' : 'Nothing in this filter.'}
                </div>
              ) : (
                (['today', 'week', 'earlier'] as const).map(
                  (b) =>
                    groups[b].length > 0 && (
                      <div key={b}>
                        <div className="border-t border-gray-100 bg-gray-50/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500 first:border-t-0 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
                          {BUCKET_TITLE[b]}
                        </div>
                        {groups[b].map((n) => {
                          const sourceBoardId = uuidFromBytes(n.source_board_id)
                          const cardTitle = (n.payload as { card_title?: string }).card_title
                          return (
                            <button
                              key={n.id}
                              onClick={() => handleClick(n.id, sourceBoardId, n.payload)}
                              className={`flex w-full flex-col items-start gap-0.5 border-b border-gray-100 px-4 py-3 text-left last:border-b-0 dark:border-gray-700 ${
                                !n.is_read
                                  ? 'bg-blue-50/50 dark:bg-blue-900/10'
                                  : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                              }`}
                            >
                              <div className="flex w-full items-center justify-between">
                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                  {TYPE_LABELS[n.type] || n.type}
                                </span>
                                {!n.is_read && (
                                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                                )}
                              </div>
                              {cardTitle && (
                                <span className="text-xs text-gray-600 dark:text-gray-400">
                                  {cardTitle}
                                </span>
                              )}
                              <span className="text-xs text-gray-400">
                                {new Date(n.created_at).toLocaleString()}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    ),
                )
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
