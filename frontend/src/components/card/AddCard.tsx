import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useCreateCard } from '@/api/cards'
import { hotkeysBus } from '@/hooks/useHotkeys'

interface Props {
  boardId: string
  listId: string
}

export default function AddCard({ boardId, listId }: Props) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const createCard = useCreateCard(boardId)

  useEffect(() => {
    return hotkeysBus.on<{ listId: string }>('add-card', (detail) => {
      if (detail?.listId === listId) setEditing(true)
    })
  }, [listId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    await createCard.mutateAsync({ listId, title: title.trim() })
    setTitle('')
    setEditing(false)
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-200"
      >
        <Plus className="h-4 w-4" />
        Add card
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <textarea
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit(e)
          }
        }}
        placeholder="Enter a title for this card..."
        className="w-full resize-none rounded-lg border border-gray-300 bg-white p-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        autoFocus
        rows={3}
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={createCard.isPending}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Add card
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false)
            setTitle('')
          }}
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </form>
  )
}
