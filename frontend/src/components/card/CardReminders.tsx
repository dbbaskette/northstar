import { useState } from 'react'
import { Bell, Plus, Trash2 } from 'lucide-react'
import {
  useCreateReminder,
  useDeleteReminder,
  useReminders,
} from '@/api/reminders'

interface Props {
  cardId: string
}

const PRESETS: { label: string; minutes: number }[] = [
  { label: 'At due time', minutes: 0 },
  { label: '15 min before', minutes: 15 },
  { label: '1 hour before', minutes: 60 },
  { label: '1 day before', minutes: 24 * 60 },
  { label: '1 week before', minutes: 7 * 24 * 60 },
]

export default function CardReminders({ cardId }: Props) {
  const { data: reminders = [] } = useReminders(cardId)
  const createReminder = useCreateReminder(cardId)
  const deleteReminder = useDeleteReminder(cardId)
  const [showPicker, setShowPicker] = useState(false)
  const [justMe, setJustMe] = useState(true)

  const formatLead = (m: number) => {
    if (m === 0) return 'At due time'
    if (m < 60) return `${m} min before`
    if (m < 60 * 24) return `${m / 60}h before`
    if (m < 60 * 24 * 7) return `${m / (60 * 24)}d before`
    return `${m / (60 * 24 * 7)}w before`
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          <Bell className="h-4 w-4" />
          Reminders
        </div>
        {!showPicker && (
          <button
            onClick={() => setShowPicker(true)}
            className="flex items-center gap-1 rounded-lg bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        )}
      </div>

      {showPicker && (
        <div className="mb-3 space-y-2 rounded-lg border border-gray-200 p-2 dark:border-gray-700">
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={justMe}
              onChange={(e) => setJustMe(e.target.checked)}
              className="rounded"
            />
            Only remind me (otherwise reminds every assignee)
          </label>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.minutes}
                onClick={async () => {
                  await createReminder.mutateAsync({ lead_minutes: p.minutes, just_me: justMe })
                  setShowPicker(false)
                }}
                className="rounded-md border border-gray-200 px-2 py-0.5 text-xs hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setShowPicker(false)}
              className="rounded-md px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {reminders.length === 0 ? (
        <div className="text-xs text-gray-400">
          No reminders. Assignees automatically get a 1-day-before reminder when a due date is set.
        </div>
      ) : (
        <div className="space-y-1">
          {reminders.map((r) => {
            const sent = r.sent_at && 'Valid' in r.sent_at && r.sent_at.Valid
            const targetsAll = !r.user_id || !('Valid' in r.user_id) || !r.user_id.Valid
            return (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-md border border-gray-200 px-2 py-1 text-xs dark:border-gray-700"
              >
                <span className={sent ? 'text-gray-400' : 'text-gray-700 dark:text-gray-300'}>
                  {formatLead(r.lead_minutes)} · {targetsAll ? 'all assignees' : 'just me'}
                  {sent && ' (sent)'}
                </span>
                <button
                  onClick={() => deleteReminder.mutate(r.id)}
                  className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-700"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
