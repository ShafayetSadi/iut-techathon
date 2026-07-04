import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import type { HistoryPoint } from '../types/dashboard'

const POLL_MS = 3000

interface HistoryResult {
  points: HistoryPoint[]
  errored: boolean
}

/**
 * Polls `GET /api/history` for the live power trend. The WebSocket snapshot
 * only carries the current instant, so the trend line is sourced here — always
 * from the backend, never synthesised on the client.
 */
export function useHistory(minutes = 30): HistoryResult {
  const [points, setPoints] = useState<HistoryPoint[]>([])
  const [errored, setErrored] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    const poll = async () => {
      try {
        const res = await api.getHistory(minutes, controller.signal)
        if (cancelled) return
        setPoints(res.points)
        setErrored(false)
      } catch {
        if (!cancelled) setErrored(true)
      } finally {
        if (!cancelled) timer.current = setTimeout(poll, POLL_MS)
      }
    }

    poll()

    return () => {
      cancelled = true
      controller.abort()
      if (timer.current) clearTimeout(timer.current)
    }
  }, [minutes])

  return { points, errored }
}
