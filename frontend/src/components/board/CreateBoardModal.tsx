import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from '../ui/Modal'
import { useCreateBoard } from '@/api/boards'
import { BOARD_COLORS } from '@/lib/constants'

interface Props {
  open: boolean
  onClose: () => void
  teamId: string
}

export default function CreateBoardModal({ open, onClose, teamId }: Props) {
  const [name, setName] = useState('')
  const [background, setBackground] = useState<string>(BOARD_COLORS[0])
  const [error, setError] = useState('')
  const createBoard = useCreateBoard()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const board = await createBoard.mutateAsync({ teamId, name, background })
      setName('')
      onClose()
      navigate(`/boards/${board.id}`)
    } catch {
      setError('Failed to create board')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create a board">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Board name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            required
            autoFocus
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Background</label>
          <div className="flex flex-wrap gap-2">
            {BOARD_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setBackground(color)}
                className={`h-10 w-10 rounded-lg border-2 transition ${
                  background === color ? 'border-gray-900' : 'border-transparent'
                }`}
                style={{ backgroundColor: color }}
                aria-label={`Color ${color}`}
              />
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createBoard.isPending || !name}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {createBoard.isPending ? 'Creating...' : 'Create board'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
