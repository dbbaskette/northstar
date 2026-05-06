import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from './client'

export interface Notification {
  id: string
  user_id: string
  type: string
  payload: Record<string, unknown>
  source_card_id?: { Bytes: number[]; Valid: boolean } | null
  source_board_id?: { Bytes: number[]; Valid: boolean } | null
  is_read: boolean
  created_at: string
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async (): Promise<Notification[]> => {
      const res = await api.get('/notifications?limit=20')
      return res.data || []
    },
    refetchInterval: 30_000,
  })
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications-count'],
    queryFn: async (): Promise<number> => {
      const res = await api.get('/notifications/count')
      return res.data?.unread ?? 0
    },
    refetchInterval: 30_000,
  })
}

export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/notifications/${id}/read`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['notifications-count'] })
    },
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await api.post('/notifications/read-all')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['notifications-count'] })
    },
  })
}

export function uuidFromBytes(b?: { Bytes: number[]; Valid: boolean } | null): string | null {
  if (!b || !b.Valid) return null
  const bytes = b.Bytes
  const hex = bytes.map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
