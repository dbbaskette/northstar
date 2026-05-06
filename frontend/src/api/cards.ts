import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from './client'
import type { BoardCard } from './boards'
import type { Checklist } from './checklists'

export interface CardLabel {
  id: string
  board_id: string
  name: string
  color: string
}

export interface CardAssignee {
  id: string
  email: string
  username: string
  display_name: string
  avatar_url?: { String: string; Valid: boolean } | null
}

export interface CardComment {
  id: string
  card_id: string
  user_id: string
  body: string
  created_at: string
  updated_at: string
  user?: CardAssignee
}

export interface CardDetail extends BoardCard {
  labels?: CardLabel[]
  assignees?: CardAssignee[]
  comments?: CardComment[]
  checklists?: Checklist[]
}

export function useCard(cardId: string | null) {
  return useQuery({
    queryKey: ['card', cardId],
    queryFn: async (): Promise<CardDetail> => {
      const res = await api.get(`/cards/${cardId}`)
      return res.data
    },
    enabled: !!cardId,
  })
}

export function useCreateCard(boardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { listId: string; title: string }): Promise<BoardCard> => {
      const res = await api.post(`/lists/${input.listId}/cards`, { title: input.title })
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['board', boardId] })
    },
  })
}

export function useUpdateCard(boardId: string, cardId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      cardId: string
      title?: string
      description?: string
      due_date?: string | null
      priority?: string | null
      completed?: boolean
    }) => {
      await api.patch(`/cards/${input.cardId}`, {
        title: input.title || '',
        description: input.description || '',
        due_date: input.due_date,
        priority: input.priority,
        completed: input.completed,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['board', boardId] })
      if (cardId) qc.invalidateQueries({ queryKey: ['card', cardId] })
    },
  })
}

export function useDeleteCard(boardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (cardId: string) => {
      await api.delete(`/cards/${cardId}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['board', boardId] })
    },
  })
}

export function useMoveCard(boardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { cardId: string; listId: string; position: number }) => {
      await api.patch(`/cards/${input.cardId}/move`, {
        list_id: input.listId,
        position: input.position,
      })
    },
    onMutate: () => {
      // Optimistic — caller already updated cache
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: ['board', boardId] })
    },
  })
}

export function useReorderCard(boardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { cardId: string; position: number }) => {
      await api.patch(`/cards/${input.cardId}/reorder`, { position: input.position })
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: ['board', boardId] })
    },
  })
}

export function useAddComment(boardId: string, cardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: string): Promise<CardComment> => {
      const res = await api.post(`/cards/${cardId}/comments`, { body })
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['card', cardId] })
      qc.invalidateQueries({ queryKey: ['board', boardId] })
    },
  })
}

export function useDeleteComment(boardId: string, cardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (commentId: string) => {
      await api.delete(`/comments/${commentId}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['card', cardId] })
      qc.invalidateQueries({ queryKey: ['board', boardId] })
    },
  })
}

export function useAttachLabel(cardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (labelId: string) => {
      await api.post(`/cards/${cardId}/labels`, { label_id: labelId })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['card', cardId] })
    },
  })
}

export function useDetachLabel(cardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (labelId: string) => {
      await api.delete(`/cards/${cardId}/labels/${labelId}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['card', cardId] })
    },
  })
}

export function useAddAssignee(cardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) => {
      await api.post(`/cards/${cardId}/assignees`, { user_id: userId })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['card', cardId] })
    },
  })
}

export function useRemoveAssignee(cardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/cards/${cardId}/assignees/${userId}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['card', cardId] })
    },
  })
}
