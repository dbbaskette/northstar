import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Image as ImageIcon, X } from 'lucide-react'
import api from '@/api/client'
import type { Attachment } from '@/api/attachments'
import type { BoardCard } from '@/api/boards'
import { cardCoverAttachmentID, cardCoverColor, cardCoverSize } from '@/lib/cardHelpers'
import { flatString } from '@/api/attachments'

const COVER_COLORS = [
  '#0079BF', '#D29034', '#519839', '#B04632',
  '#89609E', '#CD5A91', '#4BBF6B', '#00AECC',
]

interface Props {
  boardId: string
  cardId: string
  card: BoardCard
  attachments: Attachment[]
}

export default function CardCoverPicker({ boardId, cardId, card, attachments }: Props) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)

  const setCover = useMutation({
    mutationFn: async (input: {
      attachment_id?: string
      color?: string
      size?: 'half' | 'full' | ''
    }) => {
      await api.patch(`/cards/${cardId}/cover`, input)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['card', cardId] })
      qc.invalidateQueries({ queryKey: ['board', boardId] })
    },
  })

  const currentColor = cardCoverColor(card)
  const currentImageID = cardCoverAttachmentID(card)
  const currentSize = cardCoverSize(card) || 'half'
  const hasCover = currentColor || currentImageID

  const imageAttachments = attachments.filter((a) => {
    const mime = flatString(a.mime_type)
    return a.kind === 'file' && mime?.startsWith('image/')
  })

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
        <ImageIcon className="h-4 w-4" />
        Cover
      </div>

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
        >
          {hasCover ? 'Change cover' : 'Pick a cover'}
        </button>
      ) : (
        <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-700">
          <div>
            <div className="mb-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300">Color</div>
            <div className="flex flex-wrap gap-1.5">
              {COVER_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setCover.mutate({ color: c, attachment_id: '', size: '' })}
                  className={`h-6 w-10 rounded ${
                    currentColor === c ? 'ring-2 ring-gray-700 ring-offset-1 dark:ring-gray-300' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {imageAttachments.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300">From attachments</div>
              <div className="grid grid-cols-4 gap-2">
                {imageAttachments.map((a) => (
                  <button
                    key={a.id}
                    onClick={() =>
                      setCover.mutate({
                        attachment_id: a.id,
                        color: '',
                        size: currentImageID === a.id ? currentSize : 'half',
                      })
                    }
                    className={`h-12 overflow-hidden rounded border-2 ${
                      currentImageID === a.id ? 'border-blue-500' : 'border-transparent hover:border-gray-300'
                    }`}
                  >
                    <img
                      src={`/api/v1/attachments/${a.id}/download`}
                      alt={a.filename}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
              {currentImageID && (
                <div className="mt-2 flex gap-1.5">
                  <button
                    onClick={() => setCover.mutate({ attachment_id: currentImageID, size: 'half' })}
                    className={`flex-1 rounded-md border px-2 py-0.5 text-xs ${
                      currentSize === 'half'
                        ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-900/30'
                        : 'border-gray-200 dark:border-gray-600 dark:text-gray-300'
                    }`}
                  >
                    Half
                  </button>
                  <button
                    onClick={() => setCover.mutate({ attachment_id: currentImageID, size: 'full' })}
                    className={`flex-1 rounded-md border px-2 py-0.5 text-xs ${
                      currentSize === 'full'
                        ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-900/30'
                        : 'border-gray-200 dark:border-gray-600 dark:text-gray-300'
                    }`}
                  >
                    Full
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between">
            {hasCover && (
              <button
                onClick={() => setCover.mutate({ attachment_id: '', color: '', size: '' })}
                className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <X className="h-3.5 w-3.5" />
                Remove cover
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="ml-auto rounded-md px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
