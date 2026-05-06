import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from './client'

export interface Attachment {
  id: string
  card_id: string
  uploader_id: string
  kind: 'file' | 'url'
  filename: string
  mime_type?: { String: string; Valid: boolean } | string | null
  size_bytes?: { Int64: number; Valid: boolean } | number | null
  url?: { String: string; Valid: boolean } | string | null
  created_at: string
}

export function useUploadAttachment(boardId: string, cardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File): Promise<Attachment> => {
      const form = new FormData()
      form.append('file', file)
      const res = await api.post(`/cards/${cardId}/attachments`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['card', cardId] })
      qc.invalidateQueries({ queryKey: ['board', boardId] })
    },
  })
}

export function useAddUrlAttachment(boardId: string, cardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { url: string; name?: string }): Promise<Attachment> => {
      const res = await api.post(`/cards/${cardId}/attachments`, input)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['card', cardId] })
      qc.invalidateQueries({ queryKey: ['board', boardId] })
    },
  })
}

export function useDeleteAttachment(boardId: string, cardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (attachmentId: string) => {
      await api.delete(`/attachments/${attachmentId}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['card', cardId] })
      qc.invalidateQueries({ queryKey: ['board', boardId] })
    },
  })
}

export function flatString(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'string') return v
  if (typeof v === 'object' && 'Valid' in v && (v as { Valid: boolean }).Valid) {
    const o = v as { String?: string }
    return o.String ?? null
  }
  return null
}

export function flatNumber(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'number') return v
  if (typeof v === 'object' && 'Valid' in v && (v as { Valid: boolean }).Valid) {
    const o = v as { Int64?: number }
    return o.Int64 ?? null
  }
  return null
}
