import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from './client'

export interface AdminUser {
  id: string
  email: string
  username: string
  display_name: string
  role: string
  is_active: boolean
  deactivated_at?: string | null
  external_provider?: string | null
  created_at: string
  last_login_at?: string | null
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async (): Promise<AdminUser[]> => {
      const res = await api.get('/admin/users')
      return res.data.users || []
    },
  })
}

export function useUpdateAdminUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      userId: string
      role?: string
      is_active?: boolean
    }) => {
      const { userId, ...body } = input
      await api.patch(`/admin/users/${userId}`, body)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })
}

export function useRevokeSessions() {
  return useMutation({
    mutationFn: async (userId: string) => {
      await api.post(`/admin/users/${userId}/revoke-sessions`)
    },
  })
}

export function useBulkRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { user_ids: string[]; role: string }) => {
      await api.post('/admin/users/bulk-role', input)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })
}
