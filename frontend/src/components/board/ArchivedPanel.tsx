import { Archive, RotateCcw, Trash2, X } from 'lucide-react'
import {
  useArchived,
  usePermanentDeleteCard,
  usePermanentDeleteList,
  useRestoreCard,
  useRestoreList,
} from '@/api/archive'

interface Props {
  open: boolean
  boardId: string
  onClose: () => void
}

export default function ArchivedPanel({ open, boardId, onClose }: Props) {
  const { data, isLoading } = useArchived(open ? boardId : null)
  const restoreCard = useRestoreCard(boardId)
  const deleteCardForever = usePermanentDeleteCard(boardId)
  const restoreList = useRestoreList(boardId)
  const deleteListForever = usePermanentDeleteList(boardId)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onClose}>
      <div
        className="my-8 w-full max-w-2xl rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 p-6">
          <div className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Archived items</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="p-6 text-sm text-gray-500">Loading...</div>
        ) : (
          <div className="space-y-6 p-6">
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Lists ({data?.lists.length ?? 0})
              </h3>
              {(!data?.lists || data.lists.length === 0) ? (
                <div className="text-sm text-gray-400">No archived lists.</div>
              ) : (
                <div className="space-y-2">
                  {data.lists.map((l) => (
                    <div key={l.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <div className="text-sm font-medium text-gray-900">{l.name}</div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => restoreList.mutate(l.id)}
                          className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Restore
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Permanently delete list "${l.name}"? This cannot be undone.`)) {
                              deleteListForever.mutate(l.id)
                            }
                          }}
                          className="flex items-center gap-1 rounded-lg bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-200"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete forever
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Cards ({data?.cards.length ?? 0})
              </h3>
              {(!data?.cards || data.cards.length === 0) ? (
                <div className="text-sm text-gray-400">No archived cards.</div>
              ) : (
                <div className="space-y-2">
                  {data.cards.map((c) => (
                    <div key={c.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <div className="text-sm font-medium text-gray-900">{c.title}</div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => restoreCard.mutate(c.id)}
                          className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Restore
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Permanently delete card "${c.title}"? This cannot be undone.`)) {
                              deleteCardForever.mutate(c.id)
                            }
                          }}
                          className="flex items-center gap-1 rounded-lg bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-200"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete forever
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
