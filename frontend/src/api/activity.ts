import { useQuery } from '@tanstack/react-query'
import api from './client'

export interface Activity {
  id: string
  board_id: string
  user_id: string
  action: string
  entity_type: string
  entity_id: string
  metadata?: unknown
  created_at: string
  user?: {
    id: string
    display_name: string
    username: string
  }
}

export function useBoardActivity(boardId: string | null, limit = 50) {
  return useQuery({
    queryKey: ['activity', boardId],
    queryFn: async (): Promise<Activity[]> => {
      const res = await api.get(`/boards/${boardId}/activity?limit=${limit}`)
      return res.data || []
    },
    enabled: !!boardId,
    refetchInterval: false,
  })
}
