import { useState } from 'react'
import { Zap, X, Plus, Trash2 } from 'lucide-react'
import {
  useAutomations,
  useCreateAutomation,
  useDeleteAutomation,
  useUpdateAutomation,
  type AutomationRule,
} from '@/api/automations'
import type { Board } from '@/api/boards'

interface Props {
  open: boolean
  board: Board
  onClose: () => void
}

const EVENTS = [
  { value: 'card.created', label: 'Card created' },
  { value: 'card.moved', label: 'Card moved to a list' },
  { value: 'label.attached', label: 'Label attached' },
]

const ACTION_TYPES = [
  { value: 'add_label', label: 'Add label' },
  { value: 'remove_label', label: 'Remove label' },
  { value: 'move_to_list', label: 'Move to list' },
  { value: 'mark_complete', label: 'Mark complete' },
  { value: 'post_comment', label: 'Post comment' },
]

interface DraftAction {
  type: string
  label_id?: string
  list_id?: string
  body?: string
}

interface DraftRule {
  name: string
  event: string
  to_list_id?: string
  in_list_id?: string
  label_id?: string
  actions: DraftAction[]
}

function emptyDraft(): DraftRule {
  return { name: '', event: 'card.moved', actions: [{ type: 'add_label' }] }
}

export default function AutomationsModal({ open, board, onClose }: Props) {
  const { data: rules = [] } = useAutomations(open ? board.id : null)
  const createRule = useCreateAutomation(board.id)
  const updateRule = useUpdateAutomation(board.id)
  const deleteRule = useDeleteAutomation(board.id)

  const [editing, setEditing] = useState<AutomationRule | null>(null)
  const [draft, setDraft] = useState<DraftRule | null>(null)

  if (!open) return null

  const startNew = () => {
    setEditing(null)
    setDraft(emptyDraft())
  }

  const startEdit = (r: AutomationRule) => {
    const trigger = r.trigger as Record<string, string>
    setEditing(r)
    setDraft({
      name: r.name,
      event: trigger.event || 'card.moved',
      to_list_id: trigger.to_list_id,
      in_list_id: trigger.in_list_id,
      label_id: trigger.label_id,
      actions: r.actions as unknown as DraftAction[],
    })
  }

  const save = async () => {
    if (!draft) return
    const trigger: Record<string, unknown> = { event: draft.event }
    if (draft.to_list_id) trigger.to_list_id = draft.to_list_id
    if (draft.in_list_id) trigger.in_list_id = draft.in_list_id
    if (draft.label_id) trigger.label_id = draft.label_id

    if (editing) {
      await updateRule.mutateAsync({
        ruleId: editing.id,
        name: draft.name,
        trigger,
        actions: draft.actions as unknown as Record<string, unknown>[],
        enabled: editing.enabled,
      })
    } else {
      await createRule.mutateAsync({
        name: draft.name,
        trigger,
        actions: draft.actions as unknown as Record<string, unknown>[],
      })
    }
    setDraft(null)
    setEditing(null)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-12"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl bg-white shadow-xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 p-5 dark:border-gray-700">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            <Zap className="h-5 w-5" />
            Automation
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {!draft && (
            <>
              <button
                onClick={startNew}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                <Plus className="h-3.5 w-3.5" />
                New rule
              </button>
              {rules.length === 0 ? (
                <div className="text-sm text-gray-400">No automation rules yet.</div>
              ) : (
                <div className="space-y-2">
                  {rules.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                    >
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {r.name}
                          {!r.enabled && <span className="ml-2 text-xs text-gray-400">(disabled)</span>}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          When {(r.trigger as { event?: string }).event} → {r.actions.length}{' '}
                          action{r.actions.length === 1 ? '' : 's'}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(r)}
                          className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete rule "${r.name}"?`)) {
                              deleteRule.mutate(r.id)
                            }
                          }}
                          className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {draft && (
            <RuleEditor
              draft={draft}
              setDraft={setDraft}
              board={board}
              onSave={save}
              onCancel={() => {
                setDraft(null)
                setEditing(null)
              }}
              isPending={createRule.isPending || updateRule.isPending}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function RuleEditor({
  draft,
  setDraft,
  board,
  onSave,
  onCancel,
  isPending,
}: {
  draft: DraftRule
  setDraft: (d: DraftRule) => void
  board: Board
  onSave: () => void
  onCancel: () => void
  isPending: boolean
}) {
  const lists = board.lists || []
  const labels = board.labels || []

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
          Rule name
        </label>
        <input
          type="text"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="e.g. Auto-archive completed cards"
          className="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        />
      </div>

      <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
          When
        </div>
        <select
          value={draft.event}
          onChange={(e) =>
            setDraft({
              ...draft,
              event: e.target.value,
              to_list_id: undefined,
              in_list_id: undefined,
              label_id: undefined,
            })
          }
          className="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          {EVENTS.map((e) => (
            <option key={e.value} value={e.value}>{e.label}</option>
          ))}
        </select>

        {draft.event === 'card.moved' && (
          <div className="mt-2">
            <label className="mb-0.5 block text-xs text-gray-600 dark:text-gray-400">to list</label>
            <select
              value={draft.to_list_id || ''}
              onChange={(e) => setDraft({ ...draft, to_list_id: e.target.value || undefined })}
              className="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="">any list</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
        )}

        {draft.event === 'card.created' && (
          <div className="mt-2">
            <label className="mb-0.5 block text-xs text-gray-600 dark:text-gray-400">in list</label>
            <select
              value={draft.in_list_id || ''}
              onChange={(e) => setDraft({ ...draft, in_list_id: e.target.value || undefined })}
              className="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="">any list</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
        )}

        {draft.event === 'label.attached' && (
          <div className="mt-2">
            <label className="mb-0.5 block text-xs text-gray-600 dark:text-gray-400">label</label>
            <select
              value={draft.label_id || ''}
              onChange={(e) => setDraft({ ...draft, label_id: e.target.value || undefined })}
              className="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="">any label</option>
              {labels.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
            Then
          </div>
          <button
            onClick={() =>
              setDraft({ ...draft, actions: [...draft.actions, { type: 'add_label' }] })
            }
            className="text-xs text-blue-600 hover:underline dark:text-blue-400"
          >
            + Add action
          </button>
        </div>
        <div className="space-y-2">
          {draft.actions.map((a, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-600 dark:bg-gray-800"
            >
              <select
                value={a.type}
                onChange={(e) => {
                  const next = [...draft.actions]
                  next[i] = { type: e.target.value }
                  setDraft({ ...draft, actions: next })
                }}
                className="rounded border border-gray-300 px-2 py-0.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              >
                {ACTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>

              {(a.type === 'add_label' || a.type === 'remove_label') && (
                <select
                  value={a.label_id || ''}
                  onChange={(e) => {
                    const next = [...draft.actions]
                    next[i] = { ...next[i]!, label_id: e.target.value }
                    setDraft({ ...draft, actions: next })
                  }}
                  className="flex-1 rounded border border-gray-300 px-2 py-0.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                >
                  <option value="">— pick label —</option>
                  {labels.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              )}

              {a.type === 'move_to_list' && (
                <select
                  value={a.list_id || ''}
                  onChange={(e) => {
                    const next = [...draft.actions]
                    next[i] = { ...next[i]!, list_id: e.target.value }
                    setDraft({ ...draft, actions: next })
                  }}
                  className="flex-1 rounded border border-gray-300 px-2 py-0.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                >
                  <option value="">— pick list —</option>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              )}

              {a.type === 'post_comment' && (
                <input
                  type="text"
                  value={a.body || ''}
                  onChange={(e) => {
                    const next = [...draft.actions]
                    next[i] = { ...next[i]!, body: e.target.value }
                    setDraft({ ...draft, actions: next })
                  }}
                  placeholder="Comment body…"
                  className="flex-1 rounded border border-gray-300 px-2 py-0.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                />
              )}

              <button
                onClick={() => {
                  const next = draft.actions.filter((_, idx) => idx !== i)
                  setDraft({ ...draft, actions: next.length ? next : [{ type: 'add_label' }] })
                }}
                className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={isPending || !draft.name.trim()}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save rule'}
        </button>
      </div>
    </div>
  )
}
