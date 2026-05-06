import { useState } from 'react'
import { CheckSquare, Plus, Trash2, X } from 'lucide-react'
import {
  useCreateChecklist,
  useCreateChecklistItem,
  useDeleteChecklist,
  useDeleteChecklistItem,
  useUpdateChecklist,
  useUpdateChecklistItem,
  type Checklist,
} from '@/api/checklists'

interface Props {
  boardId: string
  cardId: string
  checklists: Checklist[]
}

export default function CardChecklists({ boardId, cardId, checklists }: Props) {
  const [showNewForm, setShowNewForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const createChecklist = useCreateChecklist(boardId, cardId)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    await createChecklist.mutateAsync(newTitle.trim())
    setNewTitle('')
    setShowNewForm(false)
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <CheckSquare className="h-4 w-4" />
          Checklists
        </div>
        {!showNewForm && (
          <button
            onClick={() => setShowNewForm(true)}
            className="flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        )}
      </div>

      {showNewForm && (
        <form onSubmit={handleCreate} className="mb-4 flex gap-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Checklist title (e.g. Tasks)"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            autoFocus
          />
          <button
            type="submit"
            disabled={!newTitle.trim()}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              setShowNewForm(false)
              setNewTitle('')
            }}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </form>
      )}

      <div className="space-y-4">
        {checklists.map((cl) => (
          <ChecklistView key={cl.id} boardId={boardId} cardId={cardId} checklist={cl} />
        ))}
      </div>
    </div>
  )
}

function ChecklistView({
  boardId,
  cardId,
  checklist,
}: {
  boardId: string
  cardId: string
  checklist: Checklist
}) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState(checklist.title)
  const [showItemForm, setShowItemForm] = useState(false)
  const [newItemText, setNewItemText] = useState('')

  const updateChecklist = useUpdateChecklist(boardId, cardId)
  const deleteChecklist = useDeleteChecklist(boardId, cardId)
  const createItem = useCreateChecklistItem(boardId, cardId)
  const updateItem = useUpdateChecklistItem(boardId, cardId)
  const deleteItem = useDeleteChecklistItem(boardId, cardId)

  const items = checklist.items || []
  const total = items.length
  const done = items.filter((i) => i.is_complete).length
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItemText.trim()) return
    await createItem.mutateAsync({ checklistId: checklist.id, text: newItemText.trim() })
    setNewItemText('')
    // Keep form open for fast entry
  }

  const handleSaveTitle = async () => {
    if (title.trim() && title !== checklist.title) {
      await updateChecklist.mutateAsync({ checklistId: checklist.id, title: title.trim() })
    }
    setEditingTitle(false)
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        {editingTitle ? (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveTitle()
              if (e.key === 'Escape') {
                setTitle(checklist.title)
                setEditingTitle(false)
              }
            }}
            className="flex-1 rounded border border-blue-500 bg-white px-2 py-0.5 text-sm font-semibold focus:outline-none"
            autoFocus
          />
        ) : (
          <button
            onClick={() => setEditingTitle(true)}
            className="flex-1 text-left text-sm font-semibold text-gray-800"
          >
            {checklist.title}
          </button>
        )}
        <span className="text-xs font-medium text-gray-500">
          {done}/{total}
        </span>
        <button
          onClick={() => {
            if (confirm(`Delete checklist "${checklist.title}"?`)) {
              deleteChecklist.mutate(checklist.id)
            }
          }}
          className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {total > 0 && (
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full bg-green-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      <div className="space-y-1">
        {items.map((item) => (
          <div key={item.id} className="group flex items-start gap-2">
            <input
              type="checkbox"
              checked={item.is_complete}
              onChange={(e) =>
                updateItem.mutate({ itemId: item.id, is_complete: e.target.checked })
              }
              className="mt-0.5 h-4 w-4 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span
              className={`flex-1 text-sm ${
                item.is_complete ? 'text-gray-400 line-through' : 'text-gray-800'
              }`}
            >
              {item.text}
            </span>
            <button
              onClick={() => deleteItem.mutate(item.id)}
              className="opacity-0 transition-opacity group-hover:opacity-100"
            >
              <X className="h-3.5 w-3.5 text-gray-400 hover:text-red-600" />
            </button>
          </div>
        ))}
      </div>

      {showItemForm ? (
        <form onSubmit={handleAddItem} className="mt-3 flex gap-2">
          <input
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            placeholder="Add an item..."
            className="flex-1 rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            autoFocus
          />
          <button
            type="submit"
            disabled={!newItemText.trim()}
            className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              setShowItemForm(false)
              setNewItemText('')
            }}
            className="rounded-lg p-1 text-gray-500 hover:bg-gray-200"
          >
            <X className="h-4 w-4" />
          </button>
        </form>
      ) : (
        <button
          onClick={() => setShowItemForm(true)}
          className="mt-3 flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200"
        >
          <Plus className="h-3.5 w-3.5" />
          Add item
        </button>
      )}
    </div>
  )
}
