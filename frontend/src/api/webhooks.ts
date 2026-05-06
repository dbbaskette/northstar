import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from './client'

export interface Webhook {
  id: string
  board_id: string
  url: string
  secret: string
  event_filters: string[]
  active: boolean
  created_at: string
}

export interface WebhookDelivery {
  id: string
  webhook_id: string
  event: string
  status: string
  response_code?: { Int32: number; Valid: boolean } | null
  attempts: number
  queued_at: string
  delivered_at?: { Time: string; Valid: boolean } | null
}

export function useWebhooks(boardId: string | null) {
  return useQuery({
    queryKey: ['webhooks', boardId],
    queryFn: async (): Promise<Webhook[]> => {
      const res = await api.get(`/boards/${boardId}/webhooks`)
      return res.data || []
    },
    enabled: !!boardId,
  })
}

export function useCreateWebhook(boardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { url: string; event_filters?: string[] }): Promise<Webhook> => {
      const res = await api.post(`/boards/${boardId}/webhooks`, input)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks', boardId] })
    },
  })
}

export function useDeleteWebhook(boardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (webhookId: string) => {
      await api.delete(`/webhooks/${webhookId}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks', boardId] })
    },
  })
}
