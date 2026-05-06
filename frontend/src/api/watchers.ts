import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from './client'

export type WatchTargetType = 'card' | 'list' | 'board'

export function useIsWatching(targetType: WatchTargetType, targetID: string | null) {
  return useQuery({
    queryKey: ['watch', targetType, targetID],
    queryFn: async (): Promise<boolean> => {
      const res = await api.get(`/watch/${targetType}/${targetID}`)
      return !!res.data?.watching
    },
    enabled: !!targetID,
  })
}

export function useToggleWatch(targetType: WatchTargetType, targetID: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (watching: boolean) => {
      if (watching) {
        await api.post(`/watch/${targetType}/${targetID}`)
      } else {
        await api.delete(`/watch/${targetType}/${targetID}`)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['watch', targetType, targetID] })
    },
  })
}
