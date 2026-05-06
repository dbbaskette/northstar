import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from './client'
import type { Board } from './boards'

export interface BuiltInTemplate {
  id: string
  name: string
  description: string
  background: string
  lists: string[]
  labels?: { name: string; color: string }[] | null
}

export interface TemplatesResponse {
  built_in: BuiltInTemplate[]
  user_defined: Board[]
}

export function useTemplates() {
  return useQuery({
    queryKey: ['templates'],
    queryFn: async (): Promise<TemplatesResponse> => {
      const res = await api.get('/templates')
      return res.data
    },
  })
}

export function useCreateFromTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      teamId: string
      template_id?: string
      source_board_id?: string
      name: string
      background?: string
    }): Promise<{ board_id: string }> => {
      const res = await api.post(`/teams/${input.teamId}/boards/from-template`, {
        template_id: input.template_id,
        source_board_id: input.source_board_id,
        name: input.name,
        background: input.background,
      })
      return res.data
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['boards', vars.teamId] })
    },
  })
}

export function useToggleTemplate(boardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (isTemplate: boolean) => {
      await api.patch(`/boards/${boardId}/template`, { is_template: isTemplate })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['board', boardId] })
      qc.invalidateQueries({ queryKey: ['templates'] })
    },
  })
}
