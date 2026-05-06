import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useCreateList } from '@/api/lists'

interface Props {
  boardId: string
}

export default function AddList({ boardId }: Props) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const createList = useCreateList(boardId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    await createList.mutateAsync({ name: name.trim() })
    setName('')
    setEditing(false)
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex h-fit min-w-72 items-center gap-2 rounded-lg bg-white/30 px-4 py-3 text-sm font-medium text-white backdrop-blur hover:bg-white/40"
      >
        <Plus className="h-4 w-4" />
        Add list
      </button>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex h-fit min-w-72 flex-col gap-2 rounded-lg bg-gray-100 p-3"
    >
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="List name"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        autoFocus
        onBlur={() => {
          if (!name.trim()) setEditing(false)
        }}
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={createList.isPending}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Add list
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false)
            setName('')
          }}
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </form>
  )
}
