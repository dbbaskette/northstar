import { useQuery } from '@tanstack/react-query'
import api from './client'

export type WorkReason = 'assigned' | 'watching' | 'mentioned'

export interface WorkItem {
  card_id: string
  title: string
  list_id: string
  list_name: string
  board_id: string
  board_name: string
  priority?: string | null
  due_date?: string | null
  completed_at?: string | null
  updated_at: string
  reasons: WorkReason[]
}

export function useMyWork() {
  return useQuery({
    queryKey: ['me', 'work'],
    queryFn: async (): Promise<WorkItem[]> => {
      const res = await api.get('/me/work')
      return res.data.items || []
    },
    refetchInterval: 60_000,
  })
}
