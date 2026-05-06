import { useQuery } from '@tanstack/react-query'
import api from './client'

export interface SearchHit {
  card_id: string
  card_title: string
  card_description: string
  list_id: string
  list_name: string
  board_id: string
  board_name: string
  board_background: string
  team_id: string
  team_name: string
  rank: number
  is_completed: boolean
}

export interface SearchResponse {
  query: string
  results: SearchHit[]
}

export function useSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: async (): Promise<SearchResponse> => {
      const res = await api.get(`/search?q=${encodeURIComponent(query)}`)
      return res.data
    },
    enabled: query.trim().length >= 2,
    staleTime: 5_000,
  })
}
