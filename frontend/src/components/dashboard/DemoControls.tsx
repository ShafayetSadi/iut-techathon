import { useCallback, useEffect, useState } from 'react'
import {
  HeartPulse,
  Pause,
  Play,
  Clock,
  MoonStar,
  Sun,
  Database,
} from 'lucide-react'
import { api } from '../../lib/api'
import type { DemoState, HealthStatus } from '../../types/dashboard'

/**
 * Presenter console. Exercises the backend demo + health endpoints:
 *  - `GET /health`            → live system status (server, DB, simulator)
 *  - `GET /api/demo/state`    → current clock override + simulator run state
 *  - `POST /api/demo/simulator` → pause/resume random device flips
 *  - `POST /api/demo/clock`   → force after-hours to demo alerts, or go live
 * Every change lands in the backend; the dashboard reflects it on the next tick.
 */
export function DemoControls() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [demo, setDemo] = useState<DemoState | null>(null)
  const [busy, setBusy] = useState<'sim' | 'clock' | null>(null)

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const [h, d] = await Promise.all([
        api.getHealth(signal),
        api.getDemoState(signal),
      ])
      setHealth(h)
      setDemo(d)
    } catch {
      /* transient — next poll retries */
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    refresh(controller.signal)
    const id = setInterval(() => refresh(controller.signal), 8000)
    return () => {
      controller.abort()
      clearInterval(id)
    }
  }, [refresh])

  const running = demo?.simulator.running ?? health?.simulator.running ?? true
  const overridden = demo?.clock.override_active ?? false
  const healthy = health?.status === 'ok' && health?.database === 'ok'

  const toggleSimulator = async () => {
    setBusy('sim')
    try {
      await api.setSimulator(!running)
      await refresh()
    } finally {
      setBusy(null)
    }
  }

  const toggleClock = async () => {
    setBusy('clock')
    try {
      if (overridden) {
        await api.setClock(null)
      } else {
        // Today at 16:00 UTC = 22:00 Asia/Dhaka — safely after office hours.
        const d = new Date()
        d.setUTCHours(16, 0, 0, 0)
        await api.setClock(d.toISOString())
      }
      await refresh()
    } finally {
      setBusy(null)
    }
  }

  const localTime = demo?.clock.local_time
    ? new Date(demo.clock.local_time).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-hairline bg-surface px-4 py-3 backdrop-blur">
      {/* System health */}
      <div className="flex items-center gap-2">
        <span
          className={`grid h-7 w-7 place-items-center rounded-lg ${
            healthy ? 'bg-good/15 text-good' : 'bg-warn/15 text-warn'
          }`}
        >
          <HeartPulse className="h-4 w-4" />
        </span>
        <div className="leading-tight">
          <p className="text-xs font-semibold text-ink">
            {healthy ? 'System healthy' : health ? 'Degraded' : 'Checking…'}
          </p>
          <p className="flex items-center gap-1 text-[11px] text-faint">
            <Database className="h-3 w-3" />
            DB {health?.database ?? '—'} · tick{' '}
            {health?.simulator.tick_seconds ?? '—'}s
          </p>
        </div>
      </div>

      <Divider />

      {/* Business clock */}
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-faint" />
        <div className="leading-tight">
          <p className="tnum text-xs font-semibold text-ink">{localTime}</p>
          <p className="text-[11px] text-faint">
            {demo?.clock.business_timezone ?? 'Asia/Dhaka'}
            {overridden ? ' · overridden' : ' · live'}
          </p>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={toggleClock}
          disabled={busy === 'clock'}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
            overridden
              ? 'border-cyan/30 bg-cyan/10 text-cyan hover:bg-cyan/20'
              : 'border-warn/30 bg-warn/10 text-warn hover:bg-warn/20'
          }`}
        >
          {overridden ? (
            <>
              <Sun className="h-3.5 w-3.5" /> Back to live
            </>
          ) : (
            <>
              <MoonStar className="h-3.5 w-3.5" /> Force after-hours
            </>
          )}
        </button>

        <button
          type="button"
          onClick={toggleSimulator}
          disabled={busy === 'sim'}
          className="flex items-center gap-1.5 rounded-lg border border-hairline bg-white/5 px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-white/10 disabled:opacity-50"
        >
          {running ? (
            <>
              <Pause className="h-3.5 w-3.5" /> Pause sim
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" /> Resume sim
            </>
          )}
        </button>
      </div>
    </div>
  )
}

function Divider() {
  return <span className="hidden h-8 w-px bg-hairline sm:block" />
}
