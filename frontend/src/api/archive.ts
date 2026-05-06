import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from './client'
import type { BoardCard, BoardList } from './boards'

export interface ArchivedResponse {
  lists: BoardList[]
  cards: BoardCard[]
}

export function useArchived(boardId: string | null) {
  return useQuery({
    queryKey: ['archived', boardId],
    queryFn: async (): Promise<ArchivedResponse> => {
      const res = await api.get(`/boards/${boardId}/archived`)
      return {
        lists: res.data.lists || [],
        cards: res.data.cards || [],
      }
    },
    enabled: !!boardId,
  })
}

export function useRestoreCard(boardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (cardId: string) => {
      await api.post(`/cards/${cardId}/restore`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['archived', boardId] })
      qc.invalidateQueries({ queryKey: ['board', boardId] })
    },
  })
}

export function usePermanentDeleteCard(boardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (cardId: string) => {
      await api.delete(`/cards/${cardId}/permanent`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['archived', boardId] })
    },
  })
}

export function useRestoreList(boardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (listId: string) => {
      await api.post(`/lists/${listId}/restore`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['archived', boardId] })
      qc.invalidateQueries({ queryKey: ['board', boardId] })
    },
  })
}

export function usePermanentDeleteList(boardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (listId: string) => {
      await api.delete(`/lists/${listId}/permanent`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['archived', boardId] })
    },
  })
}
