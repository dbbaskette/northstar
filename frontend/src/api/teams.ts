import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from './client'

export interface Team {
  id: string
  name: string
  description?: { String: string; Valid: boolean } | string | null
  created_at: string
  updated_at: string
}

export interface TeamMember {
  team_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  joined_at: string
  user?: {
    id: string
    email: string
    username: string
    display_name: string
  }
}

export function useTeams() {
  return useQuery({
    queryKey: ['teams'],
    queryFn: async (): Promise<Team[]> => {
      const res = await api.get('/teams')
      return res.data || []
    },
  })
}

export function useTeam(teamId: string | null) {
  return useQuery({
    queryKey: ['team', teamId],
    queryFn: async (): Promise<{ team: Team; members: TeamMember[] }> => {
      const res = await api.get(`/teams/${teamId}`)
      return res.data
    },
    enabled: !!teamId,
  })
}

export function useCreateTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; description?: string }): Promise<Team> => {
      const res = await api.post('/teams', input)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] })
    },
  })
}
