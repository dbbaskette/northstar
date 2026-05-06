import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from './client'

export interface Invite {
  id: string
  board_id: string
  token: string
  email?: { String: string; Valid: boolean } | null
  role: 'admin' | 'member' | 'viewer'
  expires_at?: { Time: string; Valid: boolean } | null
  created_at: string
  accepted_at?: { Time: string; Valid: boolean } | null
}

export interface InvitePreview {
  board_id: string
  board_name: string
  team_name: string
  inviter_name: string
  role: 'admin' | 'member' | 'viewer'
}

export function useInvites(boardId: string | null) {
  return useQuery({
    queryKey: ['invites', boardId],
    queryFn: async (): Promise<Invite[]> => {
      const res = await api.get(`/boards/${boardId}/invites`)
      return res.data || []
    },
    enabled: !!boardId,
  })
}

export function useCreateInvite(boardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { email?: string; role: string; expires_in_days?: number }): Promise<Invite> => {
      const res = await api.post(`/boards/${boardId}/invites`, input)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invites', boardId] })
    },
  })
}

export function useDeleteInvite(boardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (inviteId: string) => {
      await api.delete(`/invites/${inviteId}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invites', boardId] })
    },
  })
}

export function useInvitePreview(token: string | null) {
  return useQuery({
    queryKey: ['invite-preview', token],
    queryFn: async (): Promise<InvitePreview> => {
      const res = await api.get(`/invites/${token}`)
      return res.data
    },
    enabled: !!token,
    retry: false,
  })
}

export function useAcceptInvite() {
  return useMutation({
    mutationFn: async (token: string): Promise<{ status: string; board_id: string }> => {
      const res = await api.post(`/invites/${token}/accept`)
      return res.data
    },
  })
}
