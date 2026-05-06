import { useBoardActivity } from '@/api/activity'

interface Props {
  boardId: string
}

const ACTION_LABELS: Record<string, string> = {
  'board.created': 'created this board',
  'board.updated': 'updated the board',
  'list.created': 'added a list',
  'list.updated': 'renamed a list',
  'list.archived': 'archived a list',
  'list.reordered': 'reordered lists',
  'card.created': 'added a card',
  'card.updated': 'updated a card',
  'card.moved': 'moved a card',
  'card.reordered': 'reordered a card',
  'card.deleted': 'deleted a card',
  'comment.added': 'commented on a card',
  'comment.deleted': 'deleted a comment',
  'label.attached': 'added a label',
  'label.detached': 'removed a label',
}

export default function ActivityFeed({ boardId }: Props) {
  const { data: activities = [], isLoading } = useBoardActivity(boardId)

  return (
    <div className="p-4">
      <h3 className="mb-4 text-sm font-semibold text-gray-700">Activity</h3>
      {isLoading && <div className="text-xs text-gray-500">Loading...</div>}
      {!isLoading && activities.length === 0 && (
        <div className="text-xs text-gray-500">No activity yet.</div>
      )}
      <div className="space-y-3">
        {activities.map((a) => (
          <div key={a.id} className="flex gap-2 text-sm">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
              {(a.user?.display_name || '?').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="text-gray-700">
                <span className="font-semibold">{a.user?.display_name || 'Someone'}</span>{' '}
                {ACTION_LABELS[a.action] || a.action}
              </div>
              <div className="text-xs text-gray-400">
                {new Date(a.created_at).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
