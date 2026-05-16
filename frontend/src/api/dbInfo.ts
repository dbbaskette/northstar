import { useQuery } from '@tanstack/react-query'
import api from './client'

export interface TableEncrypt {
  schema: string
  table: string
  access_method: string
  encrypted: boolean
}

export interface ExtInfo {
  name: string
  version: string
}

export interface DBInfo {
  postgres_version: string
  tde_available: boolean
  tde_installed: boolean
  encrypted_access_methods: string[]
  tables_encrypted: number
  tables_unencrypted: number
  table_sample: TableEncrypt[]
  installed_extensions: ExtInfo[]
}

export function useDBInfo() {
  return useQuery({
    queryKey: ['admin', 'db-info'],
    queryFn: async (): Promise<DBInfo> => {
      const res = await api.get('/admin/db-info')
      return res.data
    },
  })
}
