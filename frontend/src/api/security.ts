import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from './client'

export interface Session {
  id: string
  user_id: string
  ip: string
  user_agent: string
  created_at: string
  last_seen_at: string
  revoked_at?: string | null
  is_current?: boolean
}

export function useSessions() {
  return useQuery({
    queryKey: ['me', 'sessions'],
    queryFn: async (): Promise<Session[]> => {
      const res = await api.get('/me/sessions')
      return res.data.sessions || []
    },
  })
}

export function useRevokeSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (sessionId: string) => {
      await api.post(`/me/sessions/${sessionId}/revoke`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'sessions'] }),
  })
}

export function useTwoFAStatus() {
  return useQuery({
    queryKey: ['me', '2fa'],
    queryFn: async (): Promise<{ enabled: boolean }> => {
      const res = await api.get('/me/2fa')
      return res.data
    },
  })
}

export function useTwoFASetup() {
  return useMutation({
    mutationFn: async (): Promise<{ otpauth_url: string; secret: string }> => {
      const res = await api.post('/me/2fa/setup')
      return res.data
    },
  })
}

export function useTwoFAVerify() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (code: string) => {
      await api.post('/me/2fa/verify', { code })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me', '2fa'] }),
  })
}

export function useChangePassword() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { current_password: string; new_password: string }) => {
      await api.post('/me/password', input)
    },
    onSuccess: () => {
      // Refresh /users/me so the must_change_password flag clears.
      qc.invalidateQueries({ queryKey: ['user-me'] })
    },
  })
}

export type NotifPrefs = Record<string, boolean>

export function useNotifPrefs() {
  return useQuery({
    queryKey: ['me', 'notif-prefs'],
    queryFn: async (): Promise<NotifPrefs> => {
      const res = await api.get('/me/notification-prefs')
      return res.data.prefs || {}
    },
  })
}

export function useSetNotifPrefs() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (prefs: NotifPrefs) => {
      await api.patch('/me/notification-prefs', { prefs })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'notif-prefs'] }),
  })
}

export function useTwoFADisable() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await api.post('/me/2fa/disable')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me', '2fa'] }),
  })
}
