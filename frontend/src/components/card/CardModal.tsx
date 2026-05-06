import { useState, useEffect, useRef } from 'react'
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
  Copy,
  Move,
} from 'lucide-react'
import {
  useCard,
  useUpdateCard,
  useDeleteCard,
  useAddComment,
  useDeleteComment,
  useAttachLabel,
  useDetachLabel,
  useToggleReaction,
} from '@/api/cards'
import type { Board, CardPriority } from '@/api/boards'
import { useCreateLabel } from '@/api/labels'
import { useMe } from '@/api/users'
import CardChecklists from './CardChecklists'
import CardAttachments from './CardAttachments'
import CardCoverPicker from './CardCoverPicker'
import CardCopyMoveModal from './CardCopyMoveModal'
import CardCustomFields from './CardCustomFields'
import CardReminders from './CardReminders'
import Markdown from '../ui/Markdown'
import Avatar from '../ui/Avatar'
import WatchToggle from '../ui/WatchToggle'
import {
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  PRIORITY_ORDER,
  cardCompletedAt,
  cardDescription,
  cardDueDate,
  cardPriority,
  cardStartDate,
} from '@/lib/cardHelpers'
import { useHotkey } from '@/hooks/useHotkeys'

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
  const toggleReaction = useToggleReaction(board.id, cardId || '')
  const { data: me } = useMe()
  const attachLabel = useAttachLabel(cardId || '')
  const detachLabel = useDetachLabel(cardId || '')
  const createLabel = useCreateLabel(board.id)

  const [title, setTitle] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [description, setDescription] = useState('')
  const [editingDesc, setEditingDesc] = useState(false)
  const [comment, setComment] = useState('')
  const [showLabelPicker, setShowLabelPicker] = useState(false)
  const [copyMoveMode, setCopyMoveMode] = useState<'copy' | 'move' | null>(null)
  const [newLabelName, setNewLabelName] = useState('')
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0]!)
  const dueDateInputRef = useRef<HTMLInputElement>(null)

  const cardOpen = open && !!cardId
  useHotkey('e', () => setEditingDesc(true), { enabled: cardOpen })
  useHotkey('l', () => setShowLabelPicker((v) => !v), { enabled: cardOpen })
  useHotkey('d', () => dueDateInputRef.current?.focus(), { enabled: cardOpen })

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
  const startDate = card ? cardStartDate(card) : null
  const completedAt = card ? cardCompletedAt(card) : null
  const dueDateInputValue = dueDate ? dueDate.toISOString().split('T')[0] : ''
  const startDateInputValue = startDate ? startDate.toISOString().split('T')[0] : ''

  const buildUpdate = (overrides: Partial<{
    title: string
    description: string
    due_date: string | null
    start_date: string | null
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
      start_date:
        'start_date' in overrides
          ? overrides.start_date
          : startDate
            ? startDate.toISOString()
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

  const handleSetStartDate = async (date: string) => {
    if (!card) return
    const update = buildUpdate({ start_date: date ? new Date(date).toISOString() : null })
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
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Card details"
    >
      <div
        className="min-h-screen w-full max-w-2xl bg-white shadow-xl sm:my-8 sm:min-h-0 sm:rounded-xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-gray-200 p-6 dark:border-gray-700">
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
          <div className="ml-4 flex items-center gap-2">
            <WatchToggle targetType="card" targetID={cardId} label />
            <button
              onClick={onClose}
              aria-label="Close card"
              className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
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
                  Schedule
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-12 text-xs text-gray-500">Start</span>
                    <input
                      type="date"
                      value={startDateInputValue}
                      onChange={(e) => handleSetStartDate(e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                    {startDateInputValue && (
                      <button
                        onClick={() => handleSetStartDate('')}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100"
                        aria-label="Clear start date"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-12 text-xs text-gray-500">Due</span>
                    <input
                      ref={dueDateInputRef}
                      type="date"
                      value={dueDateInputValue}
                      onChange={(e) => handleSetDueDate(e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                    {dueDateInputValue && (
                      <button
                        onClick={() => handleSetDueDate('')}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100"
                        aria-label="Clear due date"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
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
                    rows={6}
                    aria-label="Card description (Markdown supported)"
                    placeholder="Markdown supported: **bold**, *italic*, `code`, [link](url), - lists"
                    className="w-full rounded-lg border border-gray-300 p-2 font-mono text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
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
                  className="w-full cursor-text rounded-lg bg-gray-50 p-3 text-left text-sm text-gray-600 hover:bg-gray-100"
                >
                  {description ? (
                    <Markdown source={description} />
                  ) : (
                    <span className="italic text-gray-400">Add a more detailed description… (Markdown supported)</span>
                  )}
                </button>
              )}
            </div>

            {/* Checklists */}
            <CardChecklists boardId={board.id} cardId={card.id} checklists={card.checklists || []} />

            {/* Attachments */}
            <CardAttachments boardId={board.id} cardId={card.id} attachments={card.attachments || []} />

            {/* Cover */}
            <CardCoverPicker
              boardId={board.id}
              cardId={card.id}
              card={card}
              attachments={card.attachments || []}
            />

            {/* Custom fields */}
            <CardCustomFields boardId={board.id} cardId={card.id} card={card} />

            {/* Reminders */}
            <CardReminders cardId={card.id} />

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
                        aria-label="New label name"
                        placeholder="Label name"
                        className="flex-1 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                      {LABEL_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setNewLabelColor(c)}
                          aria-label={`Choose label color ${c}`}
                          aria-pressed={newLabelColor === c}
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
                  aria-label="Comment text"
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
                    {c.user ? (
                      <Avatar
                        user={{
                          id: c.user.id,
                          display_name: c.user.display_name,
                          avatar_url: c.user.avatar_url,
                        }}
                        size="md"
                      />
                    ) : (
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        ?
                      </div>
                    )}
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
                        <Markdown source={c.body} className="text-gray-800 dark:text-gray-200" />
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {(c.reactions || []).map((r) => {
                          const mine = !!me && r.user_ids.includes(me.id)
                          return (
                            <button
                              key={r.emoji}
                              onClick={() =>
                                toggleReaction.mutate({ commentId: c.id, emoji: r.emoji })
                              }
                              className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
                                mine
                                  ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                  : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                              }`}
                            >
                              <span>{r.emoji}</span>
                              <span className="font-medium">{r.count}</span>
                            </button>
                          )
                        })}
                        <ReactionPicker
                          onPick={(emoji) =>
                            toggleReaction.mutate({ commentId: c.id, emoji })
                          }
                        />
                        <button
                          onClick={() => deleteComment.mutate(c.id)}
                          className="ml-auto text-xs text-gray-500 hover:text-red-600 dark:text-gray-400"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {(card.comments || []).length === 0 && (
                  <div className="text-xs text-gray-400">No comments yet.</div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
              <button
                onClick={() => setCopyMoveMode('copy')}
                className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              >
                <Copy className="h-4 w-4" />
                Copy
              </button>
              <button
                onClick={() => setCopyMoveMode('move')}
                className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              >
                <Move className="h-4 w-4" />
                Move
              </button>
              <button
                onClick={handleDelete}
                className="ml-auto flex items-center gap-2 text-sm text-red-600 hover:text-red-700 dark:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
                Delete card
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {copyMoveMode && (
        <CardCopyMoveModal
          open={true}
          mode={copyMoveMode}
          cardId={cardId}
          currentBoardId={board.id}
          onClose={() => {
            setCopyMoveMode(null)
            if (copyMoveMode === 'move') onClose()
          }}
        />
      )}
    </div>
  )
}

const QUICK_REACTIONS = ['👍', '👎', '❤️', '🎉', '😄', '😕', '🚀', '👀']

function ReactionPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
        title="Add reaction"
      >
        +
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 flex gap-0.5 rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  onPick(emoji)
                  setOpen(false)
                }}
                className="rounded p-1 text-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
