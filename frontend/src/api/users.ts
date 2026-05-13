import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from './client'

export interface UserProfile {
  id: string
  email: string
  username: string
  display_name: string
  avatar_url?: { String: string; Valid: boolean } | string | null
  bio?: { String: string; Valid: boolean } | string | null
  timezone?: { String: string; Valid: boolean } | string | null
  role: string
  must_change_password?: boolean
}

export function useMe() {
  return useQuery({
    queryKey: ['user-me'],
    queryFn: async (): Promise<UserProfile> => {
      const res = await api.get('/users/me')
      return res.data
    },
  })
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async (): Promise<UserProfile[]> => {
      const res = await api.get('/users')
      return res.data || []
    },
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { display_name: string; bio: string; timezone: string }): Promise<UserProfile> => {
      const res = await api.patch('/users/me', input)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-me'] })
      qc.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

export function useUploadAvatar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File): Promise<UserProfile> => {
      const form = new FormData()
      form.append('file', file)
      const res = await api.post('/users/me/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-me'] })
      qc.invalidateQueries({ queryKey: ['users'] })
    },
  })
}
