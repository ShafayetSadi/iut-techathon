import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import type { Snapshot } from '../types/dashboard'

const POLL_MS = 3000

interface FallbackResult {
  snapshot: Snapshot | null
  errored: boolean
}

/**
 * REST polling fallback. Only runs while `active` is true (i.e. the
 * WebSocket is down). It stitches `/api/devices`, `/api/summary` and
 * `/api/alerts` into the exact same `Snapshot` shape the WS pushes, so
 * downstream components never need to branch on the data source.
 */
export function useDashboardFallback(active: boolean): FallbackResult {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [errored, setErrored] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!active) return

    let cancelled = false
    const controller = new AbortController()

    const poll = async () => {
      try {
        const [devices, summary, alerts] = await Promise.all([
          api.getDevices(controller.signal),
          api.getSummary(controller.signal),
          api.getAlerts(controller.signal),
        ])
        if (cancelled) return
        setSnapshot({
          type: 'snapshot',
          server_time: summary.server_time,
          devices: devices.devices,
          summary,
          alerts: alerts.alerts,
        })
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
  }, [active])

  return { snapshot, errored }
}
