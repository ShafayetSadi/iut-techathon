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

/** One sample on the power-history trend (`GET /api/history`). */
export interface HistoryPoint {
  ts: string
  total_power_w: number
  loads_on: number
}

export interface HistoryResponse {
  minutes: number
  points: HistoryPoint[]
}

/** Backend liveness from `GET /health`. */
export interface HealthStatus {
  status: string
  server_time: string
  database: string
  simulator: SimulatorState
}

export interface SimulatorState {
  running: boolean
  tick_seconds: number
}

export interface ClockState {
  override_active: boolean
  server_time: string
  business_timezone: string
  local_time: string
}

/** Demo-control state from `GET /api/demo/state`. */
export interface DemoState {
  clock: ClockState
  simulator: SimulatorState
}

/** One room with its five devices (`GET /api/rooms/{room}`). */
export interface RoomDetail {
  room: RoomId
  display_name: string
  devices: Device[]
  power_w: number
  loads_on: number
  device_count: number
}

/** Live-connection lifecycle surfaced to the user. */
export type ConnectionState =
  | 'connecting' // first connect, no data yet
  | 'live' // WebSocket connected, receiving snapshots
  | 'reconnecting' // WS dropped; REST fallback keeping data fresh
  | 'offline' // no live source and no data
