import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from './client'

export interface BoardMember {
  board_id: string
  user_id: string
  role: 'admin' | 'member' | 'viewer'
  user?: {
    id: string
    display_name: string
    email: string
    avatar_url?: { String: string; Valid: boolean } | null
  }
}

export function useBoardMembers(boardId: string | null) {
  return useQuery({
    queryKey: ['board-members', boardId],
    queryFn: async (): Promise<BoardMember[]> => {
      const res = await api.get(`/boards/${boardId}/members`)
      return res.data || []
    },
    enabled: !!boardId,
  })
}

export function useUpdateBoardVisibility(boardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (visibility: 'team' | 'private') => {
      await api.patch(`/boards/${boardId}/visibility`, { visibility })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['board', boardId] })
      qc.invalidateQueries({ queryKey: ['board-members', boardId] })
    },
  })
}

export function useAddBoardMember(boardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { user_id: string; role: string }) => {
      await api.post(`/boards/${boardId}/members`, input)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['board-members', boardId] })
    },
  })
}

export function useRemoveBoardMember(boardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/boards/${boardId}/members/${userId}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['board-members', boardId] })
    },
  })
}
