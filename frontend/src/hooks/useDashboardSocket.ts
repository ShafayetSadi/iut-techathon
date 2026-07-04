import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WS_URL } from '../lib/api'
import type { ConnectionState, Snapshot } from '../types/dashboard'
import { useDashboardFallback } from './useDashboardFallback'

const MAX_BACKOFF_MS = 15000

export interface LiveDashboard {
  snapshot: Snapshot | null
  connection: ConnectionState
  /** True when data is coming from REST polling rather than the socket. */
  usingFallback: boolean
  /** Wall-clock ms of the last successful data update (any source). */
  lastUpdated: number | null
}

/**
 * Primary live-data hook. Owns the WebSocket connection to `/ws`, keeps the
 * single latest snapshot in state, and reconnects with exponential backoff.
 * While the socket is down it activates the REST fallback so the dashboard
 * keeps refreshing instead of freezing. Everything renders from one snapshot.
 */
export function useDashboardSocket(): LiveDashboard {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [wsConnected, setWsConnected] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const attemptRef = useRef(0)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closedByUs = useRef(false)

  // Fall back to REST whenever the socket is not connected (including the
  // very first moments), so first paint is fast even on a slow WS handshake.
  const fallback = useDashboardFallback(!wsConnected)

  const connect = useCallback(() => {
    let ws: WebSocket
    try {
      ws = new WebSocket(WS_URL)
    } catch {
      scheduleReconnect()
      return
    }
    wsRef.current = ws

    ws.onopen = () => {
      attemptRef.current = 0
      setWsConnected(true)
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as Snapshot
        if (data && data.type === 'snapshot') {
          setSnapshot(data)
          setLastUpdated(Date.now())
        }
      } catch {
        // Ignore malformed frames; the next tick will carry a clean snapshot.
      }
    }

    ws.onerror = () => ws.close()

    ws.onclose = () => {
      setWsConnected(false)
      wsRef.current = null
      if (!closedByUs.current) scheduleReconnect()
    }

    function scheduleReconnect() {
      const attempt = attemptRef.current++
      const delay = Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS)
      const jitter = Math.random() * 400
      reconnectRef.current = setTimeout(connect, delay + jitter)
    }
  }, [])

  useEffect(() => {
    closedByUs.current = false
    connect()
    return () => {
      closedByUs.current = true
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  // When the socket is down, adopt fallback snapshots as the live data.
  useEffect(() => {
    if (!wsConnected && fallback.snapshot) {
      setSnapshot(fallback.snapshot)
      setLastUpdated(Date.now())
    }
  }, [wsConnected, fallback.snapshot])

  const connection: ConnectionState = useMemo(() => {
    if (wsConnected) return 'live'
    if (snapshot) return 'reconnecting'
    if (fallback.errored) return 'offline'
    return 'connecting'
  }, [wsConnected, snapshot, fallback.errored])

  return {
    snapshot,
    connection,
    usingFallback: !wsConnected && snapshot !== null,
    lastUpdated,
  }
}
