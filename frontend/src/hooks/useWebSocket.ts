import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'

export function useBoardWebSocket(boardId: string | null) {
  const qc = useQueryClient()
  const accessToken = useAuthStore((s) => s.accessToken)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)
  const attemptRef = useRef(0)

  useEffect(() => {
    if (!boardId || !accessToken) return

    let cancelled = false

    const connect = () => {
      if (cancelled) return
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const url = `${proto}://${window.location.host}/api/v1/ws?board_id=${boardId}&token=${encodeURIComponent(accessToken)}`

      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        attemptRef.current = 0
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type && msg.board_id === boardId) {
            qc.invalidateQueries({ queryKey: ['board', boardId] })
            qc.invalidateQueries({ queryKey: ['activity', boardId] })
            if (msg.payload?.card_id) {
              qc.invalidateQueries({ queryKey: ['card', msg.payload.card_id] })
            }
          }
        } catch {
          // ignore parse errors
        }
      }

      ws.onclose = () => {
        wsRef.current = null
        if (cancelled) return
        const delay = Math.min(30000, 1000 * Math.pow(2, attemptRef.current))
        attemptRef.current += 1
        reconnectTimerRef.current = window.setTimeout(connect, delay)
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      cancelled = true
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [boardId, accessToken, qc])
}
