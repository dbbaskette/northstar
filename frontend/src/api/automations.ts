import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from './client'

export interface AutomationRule {
  id: string
  board_id: string
  name: string
  trigger: Record<string, unknown>
  actions: Record<string, unknown>[]
  enabled: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export function useAutomations(boardId: string | null) {
  return useQuery({
    queryKey: ['automations', boardId],
    queryFn: async (): Promise<AutomationRule[]> => {
      const res = await api.get(`/boards/${boardId}/automations`)
      return res.data || []
    },
    enabled: !!boardId,
  })
}

export function useCreateAutomation(boardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      name: string
      trigger: Record<string, unknown>
      actions: Record<string, unknown>[]
      enabled?: boolean
    }) => {
      const res = await api.post(`/boards/${boardId}/automations`, {
        name: input.name,
        trigger: input.trigger,
        actions: input.actions,
        enabled: input.enabled ?? true,
      })
      return res.data as AutomationRule
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automations', boardId] })
    },
  })
}

export function useUpdateAutomation(boardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      ruleId: string
      name: string
      trigger: Record<string, unknown>
      actions: Record<string, unknown>[]
      enabled: boolean
    }) => {
      await api.patch(`/automations/${input.ruleId}`, {
        name: input.name,
        trigger: input.trigger,
        actions: input.actions,
        enabled: input.enabled,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automations', boardId] })
    },
  })
}

export function useDeleteAutomation(boardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ruleId: string) => {
      await api.delete(`/automations/${ruleId}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automations', boardId] })
    },
  })
}
