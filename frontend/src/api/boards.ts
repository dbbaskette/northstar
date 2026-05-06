import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from './client'

export interface Board {
  id: string
  team_id: string
  name: string
  description?: { String: string; Valid: boolean } | string | null
  background: string
  visibility: 'team' | 'private'
  is_archived: boolean
  created_by: string
  created_at: string
  updated_at: string
  lists?: BoardList[]
  labels?: BoardLabel[]
}

export interface BoardList {
  id: string
  board_id: string
  name: string
  position: number
  is_archived: boolean
  cards?: BoardCard[]
}

export type CardPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface BoardCard {
  id: string
  list_id: string
  title: string
  description?: { String: string; Valid: boolean } | string | null
  position: number
  priority?: { String: CardPriority; Valid: boolean } | null
  due_date?: { Time: string; Valid: boolean } | null
  completed_at?: { Time: string; Valid: boolean } | null
  is_archived: boolean
  created_at?: string
  checklist_total?: number
  checklist_done?: number
  attachment_count?: number
  labels?: BoardLabel[]
  cover_attachment_id?: { Bytes: number[]; Valid: boolean } | null
  cover_color?: { String: string; Valid: boolean } | string | null
  cover_size?: { String: string; Valid: boolean } | string | null
}

export interface BoardLabel {
  id: string
  board_id: string
  name: string
  color: string
}

export function useTeamBoards(teamId: string | null) {
  return useQuery({
    queryKey: ['boards', teamId],
    queryFn: async (): Promise<Board[]> => {
      const res = await api.get(`/teams/${teamId}/boards`)
      return res.data || []
    },
    enabled: !!teamId,
  })
}

export function useBoard(boardId: string | null) {
  return useQuery({
    queryKey: ['board', boardId],
    queryFn: async (): Promise<Board> => {
      const res = await api.get(`/boards/${boardId}`)
      return res.data
    },
    enabled: !!boardId,
  })
}

export function useCopyBoard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { boardId: string; name?: string }): Promise<{ board_id: string }> => {
      const res = await api.post(`/boards/${input.boardId}/copy`, { name: input.name })
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['boards'] })
    },
  })
}

export function useCreateBoard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      teamId: string
      name: string
      description?: string
      background?: string
    }): Promise<Board> => {
      const res = await api.post(`/teams/${input.teamId}/boards`, {
        name: input.name,
        description: input.description,
        background: input.background,
      })
      return res.data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['boards', variables.teamId] })
    },
  })
}
