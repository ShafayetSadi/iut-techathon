import type { Device, RoomId, Summary } from '../../types/dashboard'
import { ROOM_ORDER, formatRoomName } from '../../lib/room'
import { formatWatts } from '../../lib/format'
import { DeviceIndicator } from './DeviceIndicator'

interface Props {
  devices: Device[]
  summary: Summary
  busiestRoom: RoomId | null
  onSelect?: (device: Device) => void
}

/**
 * Top-view floor plan — the visual centerpiece. Three connected rooms, each
 * holding its 2 fans and 3 lights, over an abstract furniture hint. Device
 * visuals are driven entirely by backend status.
 */
export function OfficeLayout({ devices, summary, busiestRoom, onSelect }: Props) {
  const byRoom = groupByRoom(devices)

  return (
    <section className="flex h-full flex-col rounded-2xl border border-hairline bg-surface p-4 backdrop-blur sm:p-5">
      <header className="mb-4 flex items-baseline justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-ink">
            Office Floor
          </h2>
          <p className="text-xs text-muted">Top-view live device map</p>
        </div>
        <span className="text-xs text-faint">3 rooms · 15 devices</span>
      </header>

      <div className="grid flex-1 gap-3 md:grid-cols-3">
        {ROOM_ORDER.map((room) => {
          const roomDevices = byRoom[room] ?? []
          const roomSummary = summary.per_room[room]
          const fans = roomDevices.filter((d) => d.type === 'fan')
          const lights = roomDevices.filter((d) => d.type === 'light')
          const isBusiest = busiestRoom === room && (roomSummary?.power_w ?? 0) > 0

          return (
            <div
              key={room}
              className={`relative overflow-hidden rounded-xl border p-3 transition ${
                isBusiest
                  ? 'border-amber/30 bg-amber/[0.04]'
                  : 'border-hairline bg-white/[0.02]'
              }`}
            >
              {/* Furniture hint sits behind the devices */}
              <Furniture room={room} />

              <div className="relative flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-ink">
                    {formatRoomName(room)}
                  </h3>
                  <p className="tnum text-xs text-muted">
                    {formatWatts(roomSummary?.power_w ?? 0)} ·{' '}
                    {roomSummary?.loads_on ?? 0}/5 on
                  </p>
                </div>
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-good/15 px-2 py-0.5 text-[10px] font-medium text-good"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-good" />
                  Live
                </span>
              </div>

              <div className="relative mt-4 flex flex-wrap items-end gap-1">
                {fans.map((d) => (
                  <DeviceIndicator key={d.id} device={d} onSelect={onSelect} />
                ))}
                {lights.map((d) => (
                  <DeviceIndicator key={d.id} device={d} onSelect={onSelect} />
                ))}
              </div>

              {isBusiest && (
                <span className="relative mt-3 inline-block rounded-md bg-amber/10 px-2 py-0.5 text-[10px] font-medium text-amber">
                  Highest usage
                </span>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function groupByRoom(devices: Device[]): Record<RoomId, Device[]> {
  const map: Record<RoomId, Device[]> = { drawing: [], work1: [], work2: [] }
  for (const d of devices) map[d.room]?.push(d)
  return map
}

/** Abstract furniture silhouettes — a hint of layout, deliberately minimal. */
function Furniture({ room }: { room: RoomId }) {
  const stroke = 'rgba(148,163,184,0.16)'
  if (room === 'drawing') {
    return (
      <svg
        className="pointer-events-none absolute bottom-2 right-2 h-16 w-24 opacity-70"
        viewBox="0 0 96 64"
        aria-hidden
        fill="none"
        stroke={stroke}
      >
        {/* sofa + coffee table */}
        <rect x="6" y="34" width="40" height="20" rx="4" />
        <rect x="6" y="26" width="40" height="10" rx="3" />
        <rect x="58" y="40" width="30" height="14" rx="3" />
      </svg>
    )
  }
  return (
    <svg
      className="pointer-events-none absolute bottom-2 right-2 h-16 w-24 opacity-70"
      viewBox="0 0 96 64"
      aria-hidden
      fill="none"
      stroke={stroke}
    >
      {/* two desks + chairs */}
      <rect x="8" y="30" width="30" height="14" rx="2" />
      <circle cx="23" cy="52" r="5" />
      <rect x="54" y="30" width="30" height="14" rx="2" />
      <circle cx="69" cy="52" r="5" />
    </svg>
  )
}
