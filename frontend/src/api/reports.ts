import { useQuery } from '@tanstack/react-query'
import api from './client'

export interface CountByName {
  id?: string
  name: string
  count: number
}

export interface TrendPoint {
  date: string
  completed: number
  created: number
}

export interface BoardReports {
  cards_by_list: CountByName[]
  cards_by_priority: CountByName[]
  cards_by_member: CountByName[]
  completion_trend: TrendPoint[]
  open_count: number
  completed_count: number
  overdue_count: number
}

export function useBoardReports(boardId: string | null, days: number = 30) {
  return useQuery({
    queryKey: ['reports', 'board', boardId, days],
    queryFn: async (): Promise<BoardReports> => {
      const res = await api.get(`/boards/${boardId}/reports`, { params: { days } })
      return res.data
    },
    enabled: !!boardId,
  })
}
