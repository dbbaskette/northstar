import { useState } from 'react'
import Modal from '../ui/Modal'
import { useCreateTeam } from '@/api/teams'
import { useAppStore } from '@/stores/appStore'

interface Props {
  open: boolean
  onClose: () => void
}

export default function CreateTeamModal({ open, onClose }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const createTeam = useCreateTeam()
  const setActiveTeam = useAppStore((s) => s.setActiveTeam)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const team = await createTeam.mutateAsync({ name, description })
      setActiveTeam(team.id)
      setName('')
      setDescription('')
      onClose()
    } catch {
      setError('Failed to create team')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create a team">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Team name</label>
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
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Description <span className="text-xs text-gray-400">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
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
            disabled={createTeam.isPending || !name}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {createTeam.isPending ? 'Creating...' : 'Create team'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
