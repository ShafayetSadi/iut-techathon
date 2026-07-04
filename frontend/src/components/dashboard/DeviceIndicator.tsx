import { Fan, Lightbulb } from 'lucide-react'
import type { Device } from '../../types/dashboard'
import { formatRelative, formatWatts } from '../../lib/format'

interface Props {
  device: Device
  onSelect?: (device: Device) => void
}

/**
 * A single device rendered inside the office layout. Purely a reflection of
 * backend `status`:
 *  - light on  → warm amber glow
 *  - fan on    → icon spins
 * Off/inactive devices are muted slate. A hover card exposes the details.
 */
export function DeviceIndicator({ device, onSelect }: Props) {
  const on = device.status === 'on'
  const statusLabel = on ? 'ON' : 'OFF'

  return (
    <button
      type="button"
      onClick={() => onSelect?.(device)}
      aria-label={`${device.label}, ${statusLabel}, ${formatWatts(device.power_w)}`}
      title={`${device.label} · ${statusLabel}`}
      className="group relative flex flex-col items-center gap-1 rounded-xl px-2 py-1.5 outline-none transition hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-cyan/60"
    >
      {renderIcon(device)}
      <span
        className={`text-[10px] font-medium leading-none ${
          on ? 'text-ink' : 'text-faint'
        }`}
      >
        {device.label}
      </span>

      {/* Hover / focus detail card */}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-40 -translate-x-1/2 scale-95 rounded-lg border border-hairline bg-base-deep/95 p-2.5 text-left opacity-0 shadow-xl backdrop-blur transition group-hover:scale-100 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100"
      >
        <span className="block text-xs font-semibold text-ink">{device.label}</span>
        <span className="mt-1 flex items-center justify-between text-[11px] text-muted">
          <span>Status</span>
          <span className={statusColor(device)}>{statusLabel}</span>
        </span>
        <span className="flex items-center justify-between text-[11px] text-muted">
          <span>Power</span>
          <span className="tnum text-ink">{formatWatts(device.power_w)}</span>
        </span>
        <span className="flex items-center justify-between text-[11px] text-muted">
          <span>Changed</span>
          <span className="text-ink">{formatRelative(device.last_changed)}</span>
        </span>
      </span>
    </button>
  )
}

function renderIcon(device: Device) {
  if (device.type === 'fan') {
    const on = device.status === 'on'
    return (
      <span className="relative grid h-9 w-9 place-items-center">
        <Fan
          className={`h-7 w-7 ${on ? 'text-cyan animate-fan' : 'text-slate'}`}
          strokeWidth={1.75}
        />
      </span>
    )
  }

  if (device.type === 'light') {
    const on = device.status === 'on'
    return (
      <span className="relative grid h-9 w-9 place-items-center">
        {on && (
          <span
            className="absolute inset-0 rounded-full bg-amber/30 blur-md"
            aria-hidden
          />
        )}
        <Lightbulb
          className={`relative h-7 w-7 ${
            on ? 'text-amber drop-shadow-[0_0_6px_rgba(250,204,21,0.7)]' : 'text-slate'
          }`}
          strokeWidth={1.75}
          fill={on ? 'rgba(250,204,21,0.35)' : 'none'}
        />
      </span>
    )
  }
  return null
}

function statusColor(device: Device): string {
  return device.status === 'on' ? 'text-amber' : 'text-faint'
}
