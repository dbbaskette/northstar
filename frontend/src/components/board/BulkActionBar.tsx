import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Archive, ChevronDown, Flag, MoveRight, Tag, X } from 'lucide-react'
import api from '@/api/client'
import type { Board, CardPriority } from '@/api/boards'
import { useSelectionStore } from '@/stores/selectionStore'
import { confirmDialog } from '../ui/ConfirmDialog'
import { toast } from '@/lib/toast'
import { PRIORITY_COLORS, PRIORITY_LABELS, PRIORITY_ORDER } from '@/lib/cardHelpers'

interface Props {
  board: Board
}

type OpenMenu = 'move' | 'priority' | 'label' | null

// Bulk fan-out helper. Awaits all promises, returning [ok, fail].
async function fanout<T>(items: T[], fn: (item: T) => Promise<unknown>): Promise<[number, number]> {
  const results = await Promise.allSettled(items.map(fn))
  let ok = 0
  let fail = 0
  for (const r of results) {
    if (r.status === 'fulfilled') ok++
    else fail++
  }
  return [ok, fail]
}

export default function BulkActionBar({ board }: Props) {
  const ids = useSelectionStore((s) => s.selected)
  const clear = useSelectionStore((s) => s.clear)
  const qc = useQueryClient()
  const [open, setOpen] = useState<OpenMenu>(null)
  const [busy, setBusy] = useState(false)

  const selected = useMemo(() => Array.from(ids), [ids])

  if (selected.length === 0) return null

  const refresh = () => qc.invalidateQueries({ queryKey: ['board', board.id] })

  const wrap = async (label: string, fn: () => Promise<[number, number]>) => {
    setBusy(true)
    setOpen(null)
    try {
      const [ok, fail] = await fn()
      if (fail === 0) toast.success(`${label} ${ok} card${ok === 1 ? '' : 's'}`)
      else toast.error(`${label} ${ok} ok, ${fail} failed`)
    } finally {
      setBusy(false)
      refresh()
    }
  }

  const handleMove = (listId: string) =>
    wrap('Moved', () =>
      fanout(selected, (id) =>
        api.post(`/cards/${id}/move-to`, { target_list_id: listId }),
      ),
    )

  const handlePriority = (priority: CardPriority | null) =>
    wrap('Set priority on', () =>
      fanout(selected, (id) =>
        api.patch(`/cards/${id}/priority`, { priority: priority ?? '' }),
      ),
    )

  const handleLabel = (labelId: string) =>
    wrap('Labelled', () =>
      fanout(selected, (id) => api.post(`/cards/${id}/labels`, { label_id: labelId })),
    )

  const handleArchive = async () => {
    const ok = await confirmDialog({
      title: `Archive ${selected.length} card${selected.length === 1 ? '' : 's'}?`,
      body: 'You can restore from the Archived panel.',
      confirmLabel: 'Archive',
      danger: true,
    })
    if (!ok) return
    await wrap('Archived', () =>
      fanout(selected, (id) => api.delete(`/cards/${id}`)),
    )
    clear()
  }

  return (
    <>
      {/* Click-away catcher for the dropdown menus. */}
      {open && (
        <div className="fixed inset-0 z-30" onClick={() => setOpen(null)} aria-hidden />
      )}
      <div
        role="toolbar"
        aria-label={`${selected.length} cards selected`}
        className="pointer-events-auto fixed bottom-4 left-1/2 z-40 -translate-x-1/2"
      >
        <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-2 py-1.5 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <span className="ml-2 mr-1 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">
            {selected.length}
          </span>
          <span className="hidden text-xs text-gray-600 sm:inline dark:text-gray-300">
            selected
          </span>

          <BarMenu
            label="Move"
            icon={<MoveRight className="h-3.5 w-3.5" />}
            isOpen={open === 'move'}
            onToggle={() => setOpen(open === 'move' ? null : 'move')}
          >
            {(board.lists || []).map((l) => (
              <button
                key={l.id}
                onClick={() => handleMove(l.id)}
                className="block w-full truncate px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                {l.name}
              </button>
            ))}
          </BarMenu>

          <BarMenu
            label="Priority"
            icon={<Flag className="h-3.5 w-3.5" />}
            isOpen={open === 'priority'}
            onToggle={() => setOpen(open === 'priority' ? null : 'priority')}
          >
            <button
              onClick={() => handlePriority(null)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <span className="h-3 w-3 rounded-full border border-gray-300" />
              None
            </button>
            {PRIORITY_ORDER.map((p) => (
              <button
                key={p}
                onClick={() => handlePriority(p)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: PRIORITY_COLORS[p] }}
                />
                {PRIORITY_LABELS[p]}
              </button>
            ))}
          </BarMenu>

          {(board.labels || []).length > 0 && (
            <BarMenu
              label="Label"
              icon={<Tag className="h-3.5 w-3.5" />}
              isOpen={open === 'label'}
              onToggle={() => setOpen(open === 'label' ? null : 'label')}
            >
              {(board.labels || []).map((l) => (
                <button
                  key={l.id}
                  onClick={() => handleLabel(l.id)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <span
                    className="h-3 w-3 rounded"
                    style={{ backgroundColor: l.color }}
                  />
                  <span className="truncate text-gray-700 dark:text-gray-200">{l.name}</span>
                </button>
              ))}
            </BarMenu>
          )}

          <button
            onClick={handleArchive}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-900/30"
          >
            <Archive className="h-3.5 w-3.5" />
            Archive
          </button>

          <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />

          <button
            onClick={clear}
            aria-label="Clear selection"
            className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </>
  )
}

function BarMenu({
  label,
  icon,
  isOpen,
  onToggle,
  children,
}: {
  label: string
  icon: React.ReactNode
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium ${
          isOpen
            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200'
            : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
        }`}
      >
        {icon}
        {label}
        <ChevronDown className="h-3 w-3" />
      </button>
      {isOpen && (
        <div
          role="menu"
          className="absolute bottom-full left-1/2 z-40 mb-2 w-56 -translate-x-1/2 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-xl dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="max-h-64 overflow-y-auto">{children}</div>
        </div>
      )}
    </div>
  )
}
