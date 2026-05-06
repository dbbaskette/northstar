import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from './client'

export interface Plugin {
  id: string
  name: string
  description: string
  manifest_url: string
  iframe_url: string
  version: string
  capabilities: string[] | null
  created_at: string
}

export interface BoardPlugin {
  board_id: string
  plugin_id: string
  plugin?: Plugin
  config: Record<string, unknown>
  enabled_at: string
}

export function usePlugins() {
  return useQuery({
    queryKey: ['admin', 'plugins'],
    queryFn: async (): Promise<Plugin[]> => {
      const res = await api.get('/admin/plugins')
      return res.data.plugins || []
    },
  })
}

export function useRegisterPlugin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      name: string
      description: string
      iframe_url: string
      manifest_url: string
      version: string
      capabilities: string[]
    }) => {
      await api.post('/admin/plugins', input)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'plugins'] }),
  })
}

export function useUnregisterPlugin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (pluginId: string) => {
      await api.delete(`/admin/plugins/${pluginId}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'plugins'] }),
  })
}

export function useBoardPlugins(boardId: string | null) {
  return useQuery({
    queryKey: ['boards', boardId, 'plugins'],
    queryFn: async (): Promise<BoardPlugin[]> => {
      const res = await api.get(`/boards/${boardId}/plugins`)
      return res.data.plugins || []
    },
    enabled: !!boardId,
  })
}

export function useEnableBoardPlugin(boardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (pluginId: string) => {
      await api.post(`/boards/${boardId}/plugins/${pluginId}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['boards', boardId, 'plugins'] }),
  })
}

export function useDisableBoardPlugin(boardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (pluginId: string) => {
      await api.delete(`/boards/${boardId}/plugins/${pluginId}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['boards', boardId, 'plugins'] }),
  })
}
