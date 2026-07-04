import type { Device, Summary } from '../types/dashboard'

/** "420W" — whole watts, no decimals. */
export function formatWatts(value: number): string {
  return `${Math.round(value ?? 0)}W`
}

/** "3.8 kWh" — one decimal place. */
export function formatKwh(value: number): string {
  return `${(value ?? 0).toFixed(1)} kWh`
}

/** Human clock time, e.g. "4:22:10 PM". */
export function formatTimestamp(value: string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  })
}

/** Compact relative time, e.g. "just now", "3m ago", "2h ago". */
export function formatRelative(value: string, now: number = Date.now()): string {
  const t = new Date(value).getTime()
  if (Number.isNaN(t)) return '—'
  const diff = Math.max(0, now - t)
  const s = Math.floor(diff / 1000)
  if (s < 45) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  return `${days}d ago`
}

/** True for load devices (fans/lights) that are currently drawing power. */
export function isOn(device: Device): boolean {
  return device.status === 'on'
}

export function isLoad(device: Device): boolean {
  return device.type === 'fan' || device.type === 'light'
}

/**
 * Safety net only. The backend `summary` is the source of truth for these
 * numbers; this derives an equivalent shape from the device array when a
 * snapshot arrives without a summary (e.g. a partial REST fallback).
 */
export function deriveSummary(devices: Device[], serverTime: string): Summary {
  const rooms: Summary['per_room'] = {
    drawing: emptyRoom('drawing'),
    work1: emptyRoom('work1'),
    work2: emptyRoom('work2'),
  }
  let total = 0
  let loadsOn = 0

  for (const d of devices) {
    const r = rooms[d.room]
    if (!r) continue
    r.device_count += 1
    if (isLoad(d)) {
      if (d.status === 'on') {
        total += d.power_w
        loadsOn += 1
        r.power_w += d.power_w
        r.loads_on += 1
      }
    }
  }

  return {
    total_power_w: total,
    per_room: rooms,
    today_kwh: 0,
    load_count_on: loadsOn,
    device_count: devices.length,
    server_time: serverTime,
  }
}

function emptyRoom(room: 'drawing' | 'work1' | 'work2'): Summary['per_room'][keyof Summary['per_room']] {
  const names = { drawing: 'Drawing Room', work1: 'Work Room 1', work2: 'Work Room 2' }
  return {
    room,
    display_name: names[room],
    power_w: 0,
    loads_on: 0,
    device_count: 0,
  }
}
