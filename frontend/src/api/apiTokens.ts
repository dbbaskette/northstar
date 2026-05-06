import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from './client'

export interface APIToken {
  id: string
  user_id: string
  name: string
  last_used_at?: { Time: string; Valid: boolean } | null
  expires_at?: { Time: string; Valid: boolean } | null
  created_at: string
  token?: string // Only set on the create response
}

export function useAPITokens() {
  return useQuery({
    queryKey: ['api-tokens'],
    queryFn: async (): Promise<APIToken[]> => {
      const res = await api.get('/auth/tokens')
      return res.data || []
    },
  })
}

export function useCreateAPIToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; expires_in_days?: number }): Promise<APIToken> => {
      const res = await api.post('/auth/tokens', input)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['api-tokens'] })
    },
  })
}

export function useDeleteAPIToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/auth/tokens/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['api-tokens'] })
    },
  })
}
