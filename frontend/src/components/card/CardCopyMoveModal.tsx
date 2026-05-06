import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Copy, Move, X } from 'lucide-react'
import api from '@/api/client'
import { useTeams } from '@/api/teams'
import { useTeamBoards, useBoard } from '@/api/boards'

interface Props {
  open: boolean
  mode: 'copy' | 'move'
  cardId: string
  currentBoardId: string
  onClose: () => void
}

export default function CardCopyMoveModal({ open, mode, cardId, currentBoardId, onClose }: Props) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { data: teams = [] } = useTeams()
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [selectedBoardId, setSelectedBoardId] = useState('')
  const [selectedListId, setSelectedListId] = useState('')
  const [error, setError] = useState('')

  const [opts, setOpts] = useState({
    description: true,
    checklists: true,
    attachments: true,
    comments: false,
    labels: true,
    assignees: false,
    due_date: true,
    priority: true,
  })

  const { data: boards = [] } = useTeamBoards(selectedTeamId || null)
  const { data: targetBoard } = useBoard(selectedBoardId || null)

  const performAction = useMutation({
    mutationFn: async () => {
      if (mode === 'copy') {
        const res = await api.post(`/cards/${cardId}/copy`, {
          target_list_id: selectedListId,
          include: opts,
        })
        return res.data?.card_id as string
      } else {
        await api.post(`/cards/${cardId}/move-to`, { target_list_id: selectedListId })
        return cardId
      }
    },
    onSuccess: (resultCardId) => {
      qc.invalidateQueries({ queryKey: ['board', currentBoardId] })
      qc.invalidateQueries({ queryKey: ['board', selectedBoardId] })
      onClose()
      if (selectedBoardId !== currentBoardId) {
        navigate(`/boards/${selectedBoardId}`)
      }
      void resultCardId
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        `Failed to ${mode} card`
      setError(msg)
    },
  })

  if (!open) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedListId) {
      setError('Pick a target list.')
      return
    }
    setError('')
    performAction.mutate()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-20"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 p-5 dark:border-gray-700">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            {mode === 'copy' ? <Copy className="h-5 w-5" /> : <Move className="h-5 w-5" />}
            {mode === 'copy' ? 'Copy card' : 'Move card'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {error && (
            <div className="rounded-lg bg-red-50 p-2 text-xs text-red-600 dark:bg-red-900/30 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                Team
              </label>
              <select
                value={selectedTeamId}
                onChange={(e) => {
                  setSelectedTeamId(e.target.value)
                  setSelectedBoardId('')
                  setSelectedListId('')
                }}
                className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                required
              >
                <option value="">Select…</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                Board
              </label>
              <select
                value={selectedBoardId}
                onChange={(e) => {
                  setSelectedBoardId(e.target.value)
                  setSelectedListId('')
                }}
                disabled={!selectedTeamId}
                className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                required
              >
                <option value="">Select…</option>
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                List
              </label>
              <select
                value={selectedListId}
                onChange={(e) => setSelectedListId(e.target.value)}
                disabled={!selectedBoardId}
                className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                required
              >
                <option value="">Select…</option>
                {(targetBoard?.lists || []).map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>

          {mode === 'copy' && (
            <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <div className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-300">Include</div>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {(Object.keys(opts) as Array<keyof typeof opts>).map((k) => (
                  <label key={k} className="flex cursor-pointer items-center gap-2 text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={opts[k]}
                      onChange={(e) => setOpts({ ...opts, [k]: e.target.checked })}
                      className="rounded"
                    />
                    {k.replace('_', ' ')}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={performAction.isPending || !selectedListId}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {performAction.isPending
                ? mode === 'copy' ? 'Copying…' : 'Moving…'
                : mode === 'copy' ? 'Copy' : 'Move'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
