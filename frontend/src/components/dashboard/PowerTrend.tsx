import { useMemo } from 'react'
import { Activity, TrendingUp } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useHistory } from '../../hooks/useHistory'
import type { HistoryPoint } from '../../types/dashboard'

interface TrendRow {
  ts: number
  power: number
  loads: number
  label: string
}

/**
 * Live power-draw trend, sourced entirely from `GET /api/history`. The
 * WebSocket snapshot only carries the current instant, so this is the one
 * place the dashboard shows change over time — real backend samples only.
 */
export function PowerTrend({ minutes = 30 }: { minutes?: number }) {
  const { points, errored } = useHistory(minutes)

  const rows = useMemo<TrendRow[]>(
    () =>
      points.map((p: HistoryPoint) => {
        const t = new Date(p.ts).getTime()
        return {
          ts: t,
          power: p.total_power_w,
          loads: p.loads_on,
          label: new Date(p.ts).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        }
      }),
    [points],
  )

  const peak = rows.reduce((m, r) => Math.max(m, r.power), 0)
  const latest = rows.length ? rows[rows.length - 1].power : 0

  return (
    <section className="rounded-2xl border border-hairline bg-surface p-5 backdrop-blur">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-cyan" />
          <h2 className="text-sm font-semibold text-ink">Power Trend</h2>
          <span className="text-xs text-faint">last {minutes} min</span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-muted">
            Now <span className="tnum font-semibold text-cyan">{latest}W</span>
          </span>
          <span className="text-muted">
            Peak <span className="tnum font-semibold text-amber">{peak}W</span>
          </span>
        </div>
      </header>

      <div className="mt-4 h-48 w-full">
        {rows.length < 2 ? (
          <div className="flex h-full items-center justify-center gap-2 text-xs text-faint">
            <Activity className="h-4 w-4" />
            {errored ? 'History unavailable' : 'Collecting live samples…'}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={rows}
              margin={{ top: 6, right: 8, left: -16, bottom: 0 }}
            >
              <defs>
                <linearGradient id="powerFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.06)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                minTickGap={40}
              />
              <YAxis
                width={44}
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${v}W`}
              />
              <Tooltip
                cursor={{ stroke: 'rgba(34,211,238,0.4)' }}
                content={<TrendTooltip />}
              />
              <Area
                type="monotone"
                dataKey="power"
                stroke="#22d3ee"
                strokeWidth={2}
                fill="url(#powerFill)"
                isAnimationActive={false}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  )
}

interface TooltipProps {
  active?: boolean
  payload?: { payload: TrendRow }[]
}

function TrendTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="rounded-lg border border-hairline bg-base-deep/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <p className="tnum font-semibold text-cyan">{row.power} W</p>
      <p className="tnum text-muted">{row.loads} loads on</p>
      <p className="tnum mt-0.5 text-faint">{row.label}</p>
    </div>
  )
}
