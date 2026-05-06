import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck } from 'lucide-react'
import {
  uuidFromBytes,
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useUnreadCount,
} from '@/api/notifications'

const TYPE_LABELS: Record<string, string> = {
  'card.assigned': 'You were assigned to a card',
  'comment.added': 'New comment on a card you follow',
  mention: 'You were mentioned',
}

export default function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const { data: notifications = [] } = useNotifications()
  const { data: unread = 0 } = useUnreadCount()
  const markRead = useMarkRead()
  const markAllRead = useMarkAllRead()
  const navigate = useNavigate()

  const handleClick = (id: string, payload: Record<string, unknown>, sourceBoardID: string | null) => {
    markRead.mutate(id)
    if (sourceBoardID) {
      navigate(`/boards/${sourceBoardID}`)
    }
    void payload
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
              {unread > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-400">
                  No notifications yet.
                </div>
              ) : (
                notifications.map((n) => {
                  const sourceBoardId = uuidFromBytes(n.source_board_id)
                  const cardTitle = (n.payload as { card_title?: string }).card_title
                  return (
                    <button
                      key={n.id}
                      onClick={() => handleClick(n.id, n.payload, sourceBoardId)}
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
                        {!n.is_read && <span className="h-2 w-2 rounded-full bg-blue-500" />}
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
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
