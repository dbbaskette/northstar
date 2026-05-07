import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from './client'
import type { Board, BoardCard } from './boards'
import type { Checklist } from './checklists'
import type { Attachment } from './attachments'

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

export interface CommentReaction {
  emoji: string
  count: number
  user_ids: string[]
}

export interface CardComment {
  id: string
  card_id: string
  user_id: string
  body: string
  created_at: string
  updated_at: string
  user?: CardAssignee
  reactions?: CommentReaction[]
}

export interface CardDetail extends BoardCard {
  labels?: CardLabel[]
  assignees?: CardAssignee[]
  comments?: CardComment[]
  checklists?: Checklist[]
  attachments?: Attachment[]
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
    // Optimistic insert: drop a temp card at the end of the target list so
    // the user sees their new card the instant they hit Enter. Reconciled
    // on settle when the server's real id replaces the temp one.
    onMutate: async ({ listId, title }) => {
      await qc.cancelQueries({ queryKey: ['board', boardId] })
      const snapshot = qc.getQueryData<Board>(['board', boardId])
      if (snapshot) {
        const temp: BoardCard = {
          id: `tmp-${Date.now()}`,
          list_id: listId,
          title,
          position: Number.MAX_SAFE_INTEGER,
          is_archived: false,
        } as BoardCard
        qc.setQueryData<Board>(['board', boardId], {
          ...snapshot,
          lists: (snapshot.lists || []).map((l) =>
            l.id === listId ? { ...l, cards: [...(l.cards || []), temp] } : l,
          ),
        })
      }
      return { snapshot }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(['board', boardId], ctx.snapshot)
    },
    onSettled: () => {
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
      start_date?: string | null
      priority?: string | null
      completed?: boolean
    }) => {
      await api.patch(`/cards/${input.cardId}`, {
        title: input.title || '',
        description: input.description || '',
        due_date: input.due_date,
        start_date: input.start_date,
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

export function useVoteCard(boardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { cardId: string; vote: boolean }) => {
      if (input.vote) await api.post(`/cards/${input.cardId}/vote`)
      else await api.delete(`/cards/${input.cardId}/vote`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['board', boardId] })
    },
  })
}

export function useDeleteCard(boardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (cardId: string) => {
      await api.delete(`/cards/${cardId}`)
    },
    onMutate: async (cardId) => {
      await qc.cancelQueries({ queryKey: ['board', boardId] })
      const snapshot = qc.getQueryData<Board>(['board', boardId])
      if (snapshot) {
        qc.setQueryData<Board>(['board', boardId], {
          ...snapshot,
          lists: (snapshot.lists || []).map((l) => ({
            ...l,
            cards: (l.cards || []).filter((c) => c.id !== cardId),
          })),
        })
      }
      return { snapshot }
    },
    onError: (_err, _cardId, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(['board', boardId], ctx.snapshot)
    },
    onSettled: () => {
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

export function useToggleReaction(boardId: string, cardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { commentId: string; emoji: string }) => {
      await api.post(
        `/comments/${input.commentId}/reactions/${encodeURIComponent(input.emoji)}`,
      )
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
