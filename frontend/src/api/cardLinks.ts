import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from './client'

export type RelationType = 'related' | 'duplicate' | 'blocks'

export interface CardLink {
  id: string
  from_card_id: string
  to_card_id: string
  relation_type: RelationType
  direction: 'outgoing' | 'incoming'
  other_card_id: string
  other_card_title: string
  other_board_id: string
  other_board_name: string
  created_at: string
}

export function useCardLinks(cardId: string | null) {
  return useQuery({
    queryKey: ['card-links', cardId],
    queryFn: async (): Promise<CardLink[]> => {
      const res = await api.get(`/cards/${cardId}/links`)
      return res.data.links || []
    },
    enabled: !!cardId,
  })
}

export function useCreateCardLink(cardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { to_card_id: string; relation_type: RelationType }) => {
      const res = await api.post(`/cards/${cardId}/links`, input)
      return res.data as CardLink
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['card-links', cardId] }),
  })
}

export function useDeleteCardLink(cardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (linkId: string) => {
      await api.delete(`/links/${linkId}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['card-links', cardId] }),
  })
}
