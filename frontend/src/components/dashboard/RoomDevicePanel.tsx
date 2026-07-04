import { Fan, Lightbulb } from 'lucide-react'
import type { Device, RoomId, RoomSummary } from '../../types/dashboard'
import { formatRoomName } from '../../lib/room'
import { formatRelative, formatWatts } from '../../lib/format'

interface Props {
  room: RoomId
  devices: Device[]
  summary?: RoomSummary
  onSelect?: (device: Device) => void
}

/** Scannable per-room card listing all five loads with status + power. */
export function RoomDevicePanel({ room, devices, summary, onSelect }: Props) {
  const loadsOn = summary?.loads_on ?? 0

  return (
    <section className="flex flex-col rounded-2xl border border-hairline bg-surface p-4 backdrop-blur">
      <header className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ink">
            {formatRoomName(room)}
          </h3>
          <p className="tnum text-xs text-muted">
            {formatWatts(summary?.power_w ?? 0)} · {loadsOn}/
            {summary?.device_count ?? devices.length} on
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            loadsOn > 0 ? 'bg-amber/15 text-amber' : 'bg-white/5 text-faint'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              loadsOn > 0 ? 'bg-amber' : 'bg-slate'
            }`}
          />
          {loadsOn > 0 ? 'Active' : 'Idle'}
        </span>
      </header>

      <ul className="mt-3 space-y-1">
        {devices.map((device) => (
          <DeviceRow key={device.id} device={device} onSelect={onSelect} />
        ))}
      </ul>
    </section>
  )
}

function DeviceRow({
  device,
  onSelect,
}: {
  device: Device
  onSelect?: (device: Device) => void
}) {
  const on = device.status === 'on'

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect?.(device)}
        className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/50"
      >
        <RowIcon device={device} />
        <span className="min-w-0 flex-1 truncate whitespace-nowrap text-sm text-ink">
          {device.label}
        </span>
        <span
          className={`tnum w-12 shrink-0 text-right text-xs ${on ? 'text-ink' : 'text-faint'}`}
        >
          {formatWatts(device.power_w)}
        </span>
        <span className="hidden w-16 shrink-0 text-right text-[11px] text-faint sm:block">
          {formatRelative(device.last_changed)}
        </span>
        <StatusBadge on={on} />
      </button>
    </li>
  )
}

function RowIcon({ device }: { device: Device }) {
  const on = device.status === 'on'
  if (device.type === 'fan') {
    return (
      <Fan
        className={`h-4 w-4 shrink-0 ${on ? 'text-cyan animate-fan' : 'text-slate'}`}
      />
    )
  }
  return (
    <Lightbulb
      className={`h-4 w-4 shrink-0 ${on ? 'text-amber' : 'text-slate'}`}
      fill={on ? 'rgba(250,204,21,0.35)' : 'none'}
    />
  )
}

function StatusBadge({ on }: { on: boolean }) {
  return (
    <span
      className={`w-14 shrink-0 rounded-md px-1.5 py-0.5 text-center text-[10px] font-semibold ${
        on ? 'bg-amber/15 text-amber' : 'bg-white/5 text-faint'
      }`}
    >
      {on ? 'ON' : 'OFF'}
    </span>
  )
}
