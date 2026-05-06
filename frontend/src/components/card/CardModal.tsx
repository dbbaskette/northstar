import { useState, useEffect } from 'react'
import {
  X,
  AlignLeft,
  MessageSquare,
  Tag,
  Calendar,
  Trash2,
  Flag,
  CheckCircle2,
  Circle,
  Clock,
} from 'lucide-react'
import {
  useCard,
  useUpdateCard,
  useDeleteCard,
  useAddComment,
  useDeleteComment,
  useAttachLabel,
  useDetachLabel,
} from '@/api/cards'
import type { Board, CardPriority } from '@/api/boards'
import { useCreateLabel } from '@/api/labels'
import {
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  PRIORITY_ORDER,
  cardCompletedAt,
  cardDescription,
  cardDueDate,
  cardPriority,
} from '@/lib/cardHelpers'

interface Props {
  open: boolean
  cardId: string | null
  board: Board
  onClose: () => void
}

const LABEL_COLORS = [
  '#61BD4F', '#F2D600', '#FF9F1A', '#EB5A46',
  '#C377E0', '#0079BF', '#00C2E0', '#51E898',
]

export default function CardModal({ open, cardId, board, onClose }: Props) {
  const { data: card, isLoading } = useCard(cardId)
  const updateCard = useUpdateCard(board.id, cardId || undefined)
  const deleteCard = useDeleteCard(board.id)
  const addComment = useAddComment(board.id, cardId || '')
  const deleteComment = useDeleteComment(board.id, cardId || '')
  const attachLabel = useAttachLabel(cardId || '')
  const detachLabel = useDetachLabel(cardId || '')
  const createLabel = useCreateLabel(board.id)

  const [title, setTitle] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [description, setDescription] = useState('')
  const [editingDesc, setEditingDesc] = useState(false)
  const [comment, setComment] = useState('')
  const [showLabelPicker, setShowLabelPicker] = useState(false)
  const [newLabelName, setNewLabelName] = useState('')
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0]!)

  useEffect(() => {
    if (card) {
      setTitle(card.title)
      setDescription(cardDescription(card))
    }
  }, [card])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open || !cardId) return null

  const priority = card ? cardPriority(card) : null
  const dueDate = card ? cardDueDate(card) : null
  const completedAt = card ? cardCompletedAt(card) : null
  const dueDateInputValue = dueDate ? dueDate.toISOString().split('T')[0] : ''

  const buildUpdate = (overrides: Partial<{
    title: string
    description: string
    due_date: string | null
    priority: string | null
    completed: boolean
  }> = {}) => {
    if (!card) return null
    return {
      cardId: card.id,
      title: overrides.title ?? card.title,
      description: 'description' in overrides ? overrides.description ?? '' : description,
      due_date:
        'due_date' in overrides
          ? overrides.due_date
          : dueDate
            ? dueDate.toISOString()
            : null,
      priority: 'priority' in overrides ? overrides.priority : priority,
      ...(overrides.completed !== undefined ? { completed: overrides.completed } : {}),
    }
  }

  const handleSaveTitle = async () => {
    if (title.trim() && card && title !== card.title) {
      const update = buildUpdate({ title: title.trim() })
      if (update) await updateCard.mutateAsync(update)
    }
    setEditingTitle(false)
  }

  const handleSaveDesc = async () => {
    if (!card) return
    const update = buildUpdate({ description })
    if (update) await updateCard.mutateAsync(update)
    setEditingDesc(false)
  }

  const handleSetDueDate = async (date: string) => {
    if (!card) return
    const update = buildUpdate({ due_date: date ? new Date(date).toISOString() : null })
    if (update) await updateCard.mutateAsync(update)
  }

  const handleSetPriority = async (p: CardPriority | null) => {
    if (!card) return
    const update = buildUpdate({ priority: p ?? '' })
    if (update) await updateCard.mutateAsync(update)
  }

  const handleToggleComplete = async () => {
    if (!card) return
    const update = buildUpdate({ completed: !completedAt })
    if (update) await updateCard.mutateAsync(update)
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!comment.trim()) return
    await addComment.mutateAsync(comment.trim())
    setComment('')
  }

  const handleDelete = async () => {
    if (!card) return
    if (confirm(`Delete card "${card.title}"?`)) {
      await deleteCard.mutateAsync(card.id)
      onClose()
    }
  }

  const handleCreateAndAttachLabel = async () => {
    if (!newLabelName.trim()) return
    const label = await createLabel.mutateAsync({ name: newLabelName.trim(), color: newLabelColor })
    await attachLabel.mutateAsync(label.id)
    setNewLabelName('')
  }

  const cardLabelIds = new Set((card?.labels || []).map((l) => l.id))
  const availableLabels = (board.labels || []).filter((l) => !cardLabelIds.has(l.id))

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-2xl rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-gray-200 p-6">
          <div className="flex flex-1 items-start gap-3">
            <button
              onClick={handleToggleComplete}
              className="mt-1 flex-shrink-0 text-gray-400 hover:text-green-500"
              title={completedAt ? 'Mark incomplete' : 'Mark complete'}
            >
              {completedAt ? (
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              ) : (
                <Circle className="h-6 w-6" />
              )}
            </button>
            <div className="flex-1">
              {editingTitle ? (
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={handleSaveTitle}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTitle()
                  }}
                  className="w-full rounded border border-blue-500 px-2 py-1 text-xl font-bold text-gray-900 focus:outline-none"
                  autoFocus
                />
              ) : (
                <h2
                  onClick={() => setEditingTitle(true)}
                  className={`cursor-text text-xl font-bold ${
                    completedAt ? 'text-gray-500 line-through' : 'text-gray-900'
                  }`}
                >
                  {card?.title || 'Loading...'}
                </h2>
              )}
              {card && (
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Created {new Date(card.created_at!).toLocaleDateString()}
                  </span>
                  {completedAt && (
                    <span className="inline-flex items-center gap-1 text-green-600">
                      <CheckCircle2 className="h-3 w-3" />
                      Completed {completedAt.toLocaleDateString()}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <button onClick={onClose} className="ml-4 rounded-lg p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="p-6 text-sm text-gray-500">Loading card...</div>
        ) : card ? (
          <div className="space-y-6 p-6">
            {/* Priority + Due date row */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Flag className="h-4 w-4" />
                  Priority
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => handleSetPriority(null)}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                      priority === null
                        ? 'border-gray-700 bg-gray-100 text-gray-900'
                        : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    None
                  </button>
                  {PRIORITY_ORDER.map((p) => (
                    <button
                      key={p}
                      onClick={() => handleSetPriority(p)}
                      className={`rounded-md border-2 px-2.5 py-1 text-xs font-medium transition ${
                        priority === p
                          ? 'text-white'
                          : 'bg-white text-gray-600 hover:opacity-80'
                      }`}
                      style={{
                        borderColor: PRIORITY_COLORS[p],
                        backgroundColor: priority === p ? PRIORITY_COLORS[p] : undefined,
                      }}
                    >
                      {PRIORITY_LABELS[p]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Calendar className="h-4 w-4" />
                  Due date
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={dueDateInputValue}
                    onChange={(e) => handleSetDueDate(e.target.value)}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                  {dueDateInputValue && (
                    <button
                      onClick={() => handleSetDueDate('')}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100"
                      title="Clear due date"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Labels */}
            {(card.labels || []).length > 0 && (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Labels
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {card.labels?.map((label) => (
                    <button
                      key={label.id}
                      onClick={() => detachLabel.mutate(label.id)}
                      className="rounded px-2 py-1 text-xs font-medium text-white hover:opacity-80"
                      style={{ backgroundColor: label.color }}
                      title="Click to remove"
                    >
                      {label.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                <AlignLeft className="h-4 w-4" />
                Description
              </div>
              {editingDesc ? (
                <div className="space-y-2">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveDesc}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingDesc(false)
                        setDescription(cardDescription(card))
                      }}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setEditingDesc(true)}
                  className="w-full rounded-lg bg-gray-50 p-3 text-left text-sm text-gray-600 hover:bg-gray-100"
                >
                  {description || 'Add a more detailed description...'}
                </button>
              )}
            </div>

            {/* Add label */}
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Tag className="h-4 w-4" />
                Add label
              </div>
              <button
                onClick={() => setShowLabelPicker(!showLabelPicker)}
                className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
              >
                {showLabelPicker ? 'Hide' : 'Pick a label'}
              </button>
              {showLabelPicker && (
                <div className="mt-3 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  {availableLabels.length > 0 && (
                    <div>
                      <div className="mb-1.5 text-xs font-semibold text-gray-600">Existing</div>
                      <div className="flex flex-wrap gap-1.5">
                        {availableLabels.map((l) => (
                          <button
                            key={l.id}
                            onClick={() => attachLabel.mutate(l.id)}
                            className="rounded px-2 py-1 text-xs font-medium text-white hover:opacity-80"
                            style={{ backgroundColor: l.color }}
                          >
                            {l.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="mb-1.5 text-xs font-semibold text-gray-600">Create new</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={newLabelName}
                        onChange={(e) => setNewLabelName(e.target.value)}
                        placeholder="Label name"
                        className="flex-1 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                      {LABEL_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setNewLabelColor(c)}
                          className={`h-6 w-6 rounded ${
                            newLabelColor === c ? 'ring-2 ring-gray-700 ring-offset-1' : ''
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                      <button
                        onClick={handleCreateAndAttachLabel}
                        disabled={!newLabelName.trim()}
                        className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        Create
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Comments */}
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
                <MessageSquare className="h-4 w-4" />
                Comments
              </div>
              <form onSubmit={handleAddComment} className="mb-4 flex gap-2">
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Write a comment..."
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!comment.trim() || addComment.isPending}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Post
                </button>
              </form>
              <div className="space-y-3">
                {(card.comments || []).map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                      {(c.user?.display_name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-700">
                            {c.user?.display_name}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(c.created_at).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-gray-800">{c.body}</div>
                      </div>
                      <button
                        onClick={() => deleteComment.mutate(c.id)}
                        className="mt-1 text-xs text-gray-500 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                {(card.comments || []).length === 0 && (
                  <div className="text-xs text-gray-400">No comments yet.</div>
                )}
              </div>
            </div>

            {/* Danger zone */}
            <div className="border-t border-gray-200 pt-4">
              <button
                onClick={handleDelete}
                className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
                Delete card
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
