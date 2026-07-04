/**
 * Typed mirror of the backend contract in `docs/api-contract.md`.
 * The frontend is a reader only — these shapes describe what the backend
 * sends; the dashboard never invents or recomputes them.
 */

export type RoomId = 'drawing' | 'work1' | 'work2'
export type DeviceType = 'fan' | 'light'

/** Fans and lights use on|off. */
export type DeviceStatus = 'on' | 'off'

export type AlertType = 'after_hours' | 'long_on'

export interface Device {
  id: string
  type: DeviceType
  label: string
  room: RoomId
  status: DeviceStatus
  power_w: number
  power_rated_w: number
  last_changed: string
}

export interface RoomSummary {
  room: RoomId
  display_name: string
  power_w: number
  loads_on: number
  device_count: number
}

export interface Summary {
  total_power_w: number
  per_room: Record<RoomId, RoomSummary>
  today_kwh: number
  load_count_on: number
  device_count: number
  server_time: string
}

export interface Alert {
  id: string
  type: AlertType
  room: RoomId
  message: string
  since: string
  timestamp: string
}

/** The full dashboard snapshot pushed over the WebSocket. */
export interface Snapshot {
  type: 'snapshot'
  server_time: string
  devices: Device[]
  summary: Summary
  alerts: Alert[]
}

/** Live-connection lifecycle surfaced to the user. */
export type ConnectionState =
  | 'connecting' // first connect, no data yet
  | 'live' // WebSocket connected, receiving snapshots
  | 'reconnecting' // WS dropped; REST fallback keeping data fresh
  | 'offline' // no live source and no data
