import { useRef, useState } from 'react'
import { Paperclip, Plus, Trash2, ExternalLink, FileText, Image as ImageIcon } from 'lucide-react'
import {
  useUploadAttachment,
  useAddUrlAttachment,
  useDeleteAttachment,
  flatString,
  flatNumber,
  type Attachment,
} from '@/api/attachments'

interface Props {
  boardId: string
  cardId: string
  attachments: Attachment[]
}

export default function CardAttachments({ boardId, cardId, attachments }: Props) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [showUrlForm, setShowUrlForm] = useState(false)
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)

  const upload = useUploadAttachment(boardId, cardId)
  const addUrl = useAddUrlAttachment(boardId, cardId)
  const del = useDeleteAttachment(boardId, cardId)

  const handleFiles = async (files: FileList | null) => {
    if (!files) return
    setError('')
    for (const f of Array.from(files)) {
      try {
        await upload.mutateAsync(f)
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          `Failed to upload ${f.name}`
        setError(msg)
      }
    }
    if (fileInput.current) fileInput.current.value = ''
  }

  const handleAddUrl = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await addUrl.mutateAsync({ url, name: name || undefined })
      setUrl('')
      setName('')
      setShowUrlForm(false)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to add URL'
      setError(msg)
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Paperclip className="h-4 w-4" />
          Attachments
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => fileInput.current?.click()}
            className="flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
          >
            <Plus className="h-3.5 w-3.5" />
            File
          </button>
          <button
            onClick={() => setShowUrlForm(!showUrlForm)}
            className="flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            URL
          </button>
          <input
            ref={fileInput}
            type="file"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            multiple
          />
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-red-50 p-2 text-xs text-red-600">{error}</div>
      )}

      {showUrlForm && (
        <form onSubmit={handleAddUrl} className="mb-3 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/file.pdf"
            className="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            required
            autoFocus
          />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Display name (optional)"
            className="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowUrlForm(false)
                setUrl('')
                setName('')
              }}
              className="rounded-lg px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!url.trim()}
              className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </form>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragOver(false)
          handleFiles(e.dataTransfer.files)
        }}
        className={`rounded-lg border-2 border-dashed p-3 transition-colors ${
          isDragOver
            ? 'border-blue-400 bg-blue-50'
            : attachments.length === 0
              ? 'border-gray-200'
              : 'border-transparent'
        }`}
      >
        {attachments.length === 0 && (
          <div className="text-center text-xs text-gray-500">
            Drag &amp; drop files here, or click File above
          </div>
        )}
        <div className="space-y-2">
          {attachments.map((a) => (
            <AttachmentRow key={a.id} attachment={a} onDelete={() => del.mutate(a.id)} />
          ))}
        </div>
      </div>
    </div>
  )
}

function AttachmentRow({
  attachment,
  onDelete,
}: {
  attachment: Attachment
  onDelete: () => void
}) {
  const mime = flatString(attachment.mime_type)
  const url = flatString(attachment.url)
  const size = flatNumber(attachment.size_bytes)
  const isImage = mime?.startsWith('image/')

  const downloadUrl =
    attachment.kind === 'file'
      ? `/api/v1/attachments/${attachment.id}/download`
      : url || '#'

  return (
    <div className="flex items-center gap-3 rounded-lg bg-white p-2 shadow-sm">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-gray-100 text-gray-500">
        {isImage ? <ImageIcon className="h-5 w-5" /> : attachment.kind === 'url' ? <ExternalLink className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <a
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline"
        >
          {attachment.filename}
        </a>
        <div className="text-xs text-gray-500">
          {attachment.kind === 'file'
            ? formatSize(size)
            : 'Link'}
          {' · '}
          {new Date(attachment.created_at).toLocaleDateString()}
        </div>
      </div>
      <button
        onClick={onDelete}
        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}

function formatSize(bytes: number | null): string {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
