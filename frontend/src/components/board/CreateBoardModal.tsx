import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from '../ui/Modal'
import { useCreateBoard } from '@/api/boards'
import { useTemplates, useCreateFromTemplate } from '@/api/templates'
import { BOARD_COLORS } from '@/lib/constants'

interface Props {
  open: boolean
  onClose: () => void
  teamId: string
}

type Mode = 'blank' | 'template'

export default function CreateBoardModal({ open, onClose, teamId }: Props) {
  const [mode, setMode] = useState<Mode>('blank')
  const [name, setName] = useState('')
  const [background, setBackground] = useState<string>(BOARD_COLORS[0])
  const [templateId, setTemplateId] = useState<string>('')
  const [sourceBoardId, setSourceBoardId] = useState<string>('')
  const [error, setError] = useState('')

  const createBoard = useCreateBoard()
  const createFromTemplate = useCreateFromTemplate()
  const { data: templates } = useTemplates()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      if (mode === 'blank') {
        const board = await createBoard.mutateAsync({ teamId, name, background })
        onClose()
        navigate(`/boards/${board.id}`)
      } else {
        if (!templateId && !sourceBoardId) {
          setError('Pick a template')
          return
        }
        const res = await createFromTemplate.mutateAsync({
          teamId,
          template_id: templateId || undefined,
          source_board_id: sourceBoardId || undefined,
          name,
          background,
        })
        onClose()
        navigate(`/boards/${res.board_id}`)
      }
      setName('')
    } catch {
      setError(`Failed to create board`)
    }
  }

  const isPending = createBoard.isPending || createFromTemplate.isPending

  return (
    <Modal open={open} onClose={onClose} title="Create a board">
      <div className="mb-4 flex gap-1.5 rounded-lg bg-gray-100 p-1 dark:bg-gray-700">
        <button
          type="button"
          onClick={() => setMode('blank')}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
            mode === 'blank'
              ? 'bg-white shadow text-gray-900 dark:bg-gray-600 dark:text-gray-100'
              : 'text-gray-600 dark:text-gray-300'
          }`}
        >
          Blank
        </button>
        <button
          type="button"
          onClick={() => setMode('template')}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
            mode === 'template'
              ? 'bg-white shadow text-gray-900 dark:bg-gray-600 dark:text-gray-100'
              : 'text-gray-600 dark:text-gray-300'
          }`}
        >
          From template
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}

        {mode === 'template' && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Built-in
              </label>
              <div className="grid grid-cols-1 gap-2">
                {(templates?.built_in || []).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTemplateId(t.id)
                      setSourceBoardId('')
                      setBackground(t.background)
                      if (!name) setName(t.name)
                    }}
                    className={`flex items-start gap-3 rounded-lg border p-2 text-left ${
                      templateId === t.id
                        ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/30'
                        : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span
                      className="mt-0.5 inline-block h-8 w-8 flex-shrink-0 rounded"
                      style={{ backgroundColor: t.background }}
                    />
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{t.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            {(templates?.user_defined || []).length > 0 && (
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  My templates
                </label>
                <div className="space-y-1">
                  {(templates?.user_defined || []).map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        setSourceBoardId(b.id)
                        setTemplateId('')
                      }}
                      className={`flex w-full items-center gap-3 rounded-lg border p-2 text-left ${
                        sourceBoardId === b.id
                          ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/30'
                          : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700'
                      }`}
                    >
                      <span
                        className="inline-block h-6 w-6 flex-shrink-0 rounded"
                        style={{ backgroundColor: b.background }}
                      />
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{b.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Board name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            required
          />
        </div>
        {mode === 'blank' && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Background
            </label>
            <div className="flex flex-wrap gap-2">
              {BOARD_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setBackground(color)}
                  className={`h-10 w-10 rounded-lg border-2 transition ${
                    background === color ? 'border-gray-900 dark:border-gray-100' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={`Color ${color}`}
                />
              ))}
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending || !name}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? 'Creating...' : 'Create board'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
