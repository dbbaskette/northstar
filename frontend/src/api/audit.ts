import { useQuery } from '@tanstack/react-query'
import api from './client'

export interface AuditEntry {
  id: { Bytes: string; Valid: boolean } | string
  actor_user_id: { Bytes: string; Valid: boolean } | string
  actor_email: string
  actor_name: string
  action: string
  target_type: string
  target_id: string
  ip: string
  user_agent: string
  metadata?: string | null
  created_at: string
}

export interface AuditFilter {
  actor?: string
  action?: string
  from?: string // RFC3339
  to?: string // RFC3339
  limit?: number
  offset?: number
}

export function useAuditLog(filter: AuditFilter) {
  return useQuery({
    queryKey: ['audit-log', filter],
    queryFn: async (): Promise<{ entries: AuditEntry[]; actions: string[] }> => {
      const res = await api.get('/admin/audit-log', { params: filter })
      return { entries: res.data.entries || [], actions: res.data.actions || [] }
    },
  })
}

export function auditCSVURL(filter: AuditFilter): string {
  const qs = new URLSearchParams()
  Object.entries(filter).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  })
  return `/api/v1/admin/audit-log.csv?${qs.toString()}`
}
