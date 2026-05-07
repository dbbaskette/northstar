import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from './client'
import type { Board, BoardList } from './boards'

export function useCreateList(boardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string }): Promise<BoardList> => {
      const res = await api.post(`/boards/${boardId}/lists`, input)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['board', boardId] })
    },
  })
}

export function useUpdateList(boardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { listId: string; name: string }) => {
      await api.patch(`/lists/${input.listId}`, { name: input.name })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['board', boardId] })
    },
  })
}

export function useArchiveList(boardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (listId: string) => {
      await api.delete(`/lists/${listId}`)
    },
    onMutate: async (listId) => {
      await qc.cancelQueries({ queryKey: ['board', boardId] })
      const snapshot = qc.getQueryData<Board>(['board', boardId])
      if (snapshot) {
        qc.setQueryData<Board>(['board', boardId], {
          ...snapshot,
          lists: (snapshot.lists || []).filter((l) => l.id !== listId),
        })
      }
      return { snapshot }
    },
    onError: (_err, _listId, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(['board', boardId], ctx.snapshot)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['board', boardId] })
    },
  })
}

export function useReorderList(boardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { listId: string; position: number }) => {
      await api.patch(`/lists/${input.listId}/reorder`, { position: input.position })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['board', boardId] })
    },
  })
}

export function useCopyList(boardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (listId: string): Promise<{ list_id: string }> => {
      const res = await api.post(`/lists/${listId}/copy`)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['board', boardId] })
    },
  })
}
