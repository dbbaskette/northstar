import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from './client'

export type CustomFieldType = 'text' | 'number' | 'date' | 'checkbox' | 'dropdown'

export interface CustomFieldDef {
  id: string
  board_id: string
  name: string
  type: CustomFieldType
  options?: string[] | null
  position: number
  show_on_front: boolean
}

export function useCustomFields(boardId: string | null) {
  return useQuery({
    queryKey: ['custom-fields', boardId],
    queryFn: async (): Promise<CustomFieldDef[]> => {
      const res = await api.get(`/boards/${boardId}/custom-fields`)
      return res.data || []
    },
    enabled: !!boardId,
  })
}

export function useCreateCustomField(boardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      name: string
      type: CustomFieldType
      options?: string[]
      show_on_front?: boolean
    }) => {
      const res = await api.post(`/boards/${boardId}/custom-fields`, input)
      return res.data as CustomFieldDef
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-fields', boardId] })
    },
  })
}

export function useDeleteCustomField(boardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (fieldId: string) => {
      await api.delete(`/custom-fields/${fieldId}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custom-fields', boardId] })
    },
  })
}

export function useSetCardCustomValue(boardId: string, cardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { fieldId: string; value: unknown }) => {
      await api.put(`/cards/${cardId}/custom-fields/${input.fieldId}`, {
        value: input.value,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['card', cardId] })
      qc.invalidateQueries({ queryKey: ['board', boardId] })
    },
  })
}
