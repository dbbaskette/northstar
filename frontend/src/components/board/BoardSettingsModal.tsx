import { useEffect, useRef, useState } from 'react'
import { Settings, X, Upload, Check, Trash2 } from 'lucide-react'
import {
  useUpdateBoard,
  useUploadBoardBackground,
  type Board,
} from '@/api/boards'
import { toast } from '@/lib/toast'

interface Props {
  open: boolean
  board: Board
  onClose: () => void
}

const COLOR_PRESETS = [
  '#0079BF', '#D29034', '#519839', '#B04632',
  '#89609E', '#CD5A91', '#4BBF6B', '#00AECC',
  '#838C91', '#1F2937',
]

function isImage(bg: string): boolean {
  return bg.startsWith('/api/') || bg.startsWith('http://') || bg.startsWith('https://')
}

export default function BoardSettingsModal({ open, board, onClose }: Props) {
  const update = useUpdateBoard(board.id)
  const upload = useUploadBoardBackground(board.id)

  const [name, setName] = useState(board.name)
  const [description, setDescription] = useState(
    typeof board.description === 'string'
      ? board.description
      : board.description?.Valid
        ? board.description.String
        : '',
  )
  const [background, setBackground] = useState(board.background)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setName(board.name)
    setDescription(
      typeof board.description === 'string'
        ? board.description
        : board.description?.Valid
          ? board.description.String
          : '',
    )
    setBackground(board.background)
    setError('')
  }, [open, board.id, board.name, board.description, board.background])

  if (!open) return null

  const dirty =
    name.trim() !== board.name ||
    description !==
      (typeof board.description === 'string'
        ? board.description
        : board.description?.Valid
          ? board.description.String
          : '') ||
    background !== board.background

  const handlePickFile = () => fileRef.current?.click()

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // reset so picking the same file again still fires onChange
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Background must be an image.')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('Background image must be 8MB or smaller.')
      return
    }
    try {
      const res = await upload.mutateAsync(file)
      setBackground(res.background)
      toast.success('Background uploaded')
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e.response?.data?.error || 'Could not upload image')
    }
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    try {
      await update.mutateAsync({
        name: name.trim(),
        description,
        background,
      })
      toast.success('Board settings saved')
      onClose()
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e.response?.data?.error || 'Could not save')
    }
  }

  const previewStyle: React.CSSProperties = isImage(background)
    ? {
        backgroundImage: `url("${background}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : { backgroundColor: background || '#0079BF' }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-20"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="board-settings-title"
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white shadow-xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 p-6 dark:border-gray-700">
          <h2
            id="board-settings-title"
            className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100"
          >
            <Settings className="h-4 w-4" />
            Board settings
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-6">
          {error && (
            <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What's this board for?"
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Background
            </label>

            <div
              className="mb-3 h-24 w-full rounded-md border border-gray-200 dark:border-gray-700"
              style={previewStyle}
              aria-label="Background preview"
            />

            <div className="mb-3 flex flex-wrap gap-2">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  onClick={() => setBackground(c)}
                  aria-label={`Color ${c}`}
                  aria-pressed={background === c}
                  className={`relative h-8 w-8 rounded-md ring-offset-2 transition ${
                    background === c
                      ? 'ring-2 ring-blue-500 ring-offset-white dark:ring-offset-gray-800'
                      : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                >
                  {background === c && (
                    <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow" />
                  )}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePickFile}
                disabled={upload.isPending}
                className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              >
                <Upload className="h-3.5 w-3.5" />
                {upload.isPending ? 'Uploading…' : 'Upload image'}
              </button>
              <span className="text-[11px] text-gray-500">PNG / JPG / WebP, up to 8MB</span>
              {isImage(background) && (
                <button
                  onClick={() => setBackground(COLOR_PRESETS[0]!)}
                  className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                  title="Switch back to a solid color"
                >
                  <Trash2 className="h-3 w-3" />
                  Clear image
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleFile}
                className="hidden"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-200 p-4 dark:border-gray-700">
          <button
            onClick={onClose}
            className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty || update.isPending || !name.trim()}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {update.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
