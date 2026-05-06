import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from './client'

export interface Reminder {
  id: string
  card_id: string
  user_id?: { Bytes: number[]; Valid: boolean } | null
  lead_minutes: number
  sent_at?: { Time: string; Valid: boolean } | null
  created_at: string
}

export function useReminders(cardId: string | null) {
  return useQuery({
    queryKey: ['reminders', cardId],
    queryFn: async (): Promise<Reminder[]> => {
      const res = await api.get(`/cards/${cardId}/reminders`)
      return res.data || []
    },
    enabled: !!cardId,
  })
}

export function useCreateReminder(cardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { lead_minutes: number; just_me?: boolean }) => {
      await api.post(`/cards/${cardId}/reminders`, input)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reminders', cardId] })
    },
  })
}

export function useDeleteReminder(cardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (reminderId: string) => {
      await api.delete(`/reminders/${reminderId}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reminders', cardId] })
    },
  })
}
