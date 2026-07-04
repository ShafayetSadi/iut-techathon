import { Gauge } from 'lucide-react'
import type { RoomId, Summary } from '../../types/dashboard'
import { ROOM_ORDER, formatRoomName } from '../../lib/room'
import { formatKwh, formatWatts } from '../../lib/format'

interface Props {
  summary: Summary
  busiestRoom: RoomId | null
}

/**
 * Live power meter: dominant total watts, per-room breakdown as calm bars,
 * and today's estimated energy. No line chart — the snapshot carries no
 * history, and bars read faster for "which room is using the most".
 */
export function PowerConsumption({ summary, busiestRoom }: Props) {
  const max = Math.max(
    1,
    ...ROOM_ORDER.map((r) => summary.per_room[r]?.power_w ?? 0),
  )

  return (
    <section className="rounded-2xl border border-hairline bg-surface p-5 backdrop-blur">
      <header className="flex items-center gap-2 text-cyan">
        <Gauge className="h-4 w-4" />
        <h2 className="text-sm font-semibold text-ink">Power Consumption</h2>
      </header>

      <div className="mt-4 flex items-end justify-between border-b border-hairline/60 pb-4">
        <div>
          <span className="tnum text-2xl font-bold leading-none text-ink">
            {Math.round(summary.total_power_w)}
          </span>
          <span className="ml-1 text-sm font-medium text-muted">W</span>
          <p className="mt-1 text-xs text-faint">live total draw</p>
        </div>
        <div className="text-right">
          <span className="tnum text-lg font-semibold text-amber">
            {formatKwh(summary.today_kwh)}
          </span>
          <p className="text-xs text-faint">today's estimate</p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {ROOM_ORDER.map((room) => {
          const rs = summary.per_room[room]
          const power = rs?.power_w ?? 0
          const pct = Math.round((power / max) * 100)
          const busiest = busiestRoom === room && power > 0
          return (
            <div key={room}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-muted">{formatRoomName(room)}</span>
                <span className="tnum text-ink">
                  {formatWatts(power)}
                  <span className="ml-1.5 text-faint">
                    {rs?.loads_on ?? 0}/{rs?.device_count ?? 0} on
                  </span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/5">
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ${
                    busiest
                      ? 'bg-gradient-to-r from-amber/80 to-amber'
                      : 'bg-gradient-to-r from-cyan/60 to-cyan'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
