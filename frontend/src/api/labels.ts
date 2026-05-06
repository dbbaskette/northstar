import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from './client'

export interface Label {
  id: string
  board_id: string
  name: string
  color: string
}

export function useCreateLabel(boardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; color: string }): Promise<Label> => {
      const res = await api.post(`/boards/${boardId}/labels`, input)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['board', boardId] })
    },
  })
}

export function useDeleteLabel(boardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (labelId: string) => {
      await api.delete(`/labels/${labelId}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['board', boardId] })
    },
  })
}
