import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from './client'

export interface Checklist {
  id: string
  card_id: string
  title: string
  position: number
  items?: ChecklistItem[]
}

export interface ChecklistItem {
  id: string
  checklist_id: string
  text: string
  is_complete: boolean
  position: number
  due_date?: { Time: string; Valid: boolean } | null
  assignee_id?: { Bytes: number[]; Valid: boolean } | null
}

export function useCreateChecklist(boardId: string, cardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (title: string): Promise<Checklist> => {
      const res = await api.post(`/cards/${cardId}/checklists`, { title })
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['card', cardId] })
      qc.invalidateQueries({ queryKey: ['board', boardId] })
    },
  })
}

export function useUpdateChecklist(boardId: string, cardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { checklistId: string; title: string }) => {
      await api.patch(`/checklists/${input.checklistId}`, { title: input.title })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['card', cardId] })
      qc.invalidateQueries({ queryKey: ['board', boardId] })
    },
  })
}

export function useDeleteChecklist(boardId: string, cardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (checklistId: string) => {
      await api.delete(`/checklists/${checklistId}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['card', cardId] })
      qc.invalidateQueries({ queryKey: ['board', boardId] })
    },
  })
}

export function useCreateChecklistItem(boardId: string, cardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { checklistId: string; text: string }): Promise<ChecklistItem> => {
      const res = await api.post(`/checklists/${input.checklistId}/items`, {
        text: input.text,
      })
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['card', cardId] })
      qc.invalidateQueries({ queryKey: ['board', boardId] })
    },
  })
}

export function useUpdateChecklistItem(boardId: string, cardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      itemId: string
      text?: string
      is_complete?: boolean
    }) => {
      const body: Record<string, unknown> = {}
      if (input.text !== undefined) body.text = input.text
      if (input.is_complete !== undefined) body.is_complete = input.is_complete
      await api.patch(`/checklist-items/${input.itemId}`, body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['card', cardId] })
      qc.invalidateQueries({ queryKey: ['board', boardId] })
    },
  })
}

export function useDeleteChecklistItem(boardId: string, cardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (itemId: string) => {
      await api.delete(`/checklist-items/${itemId}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['card', cardId] })
      qc.invalidateQueries({ queryKey: ['board', boardId] })
    },
  })
}
