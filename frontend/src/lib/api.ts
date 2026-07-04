import type {
  Alert,
  DemoState,
  Device,
  DeviceStatus,
  HealthStatus,
  HistoryResponse,
  RoomDetail,
  RoomId,
  SimulatorState,
  Summary,
} from '../types/dashboard'

/**
 * Resolve backend URLs from Vite env with sensible dev defaults.
 * Both `VITE_API_BASE_URL` (project brief) and `VITE_API_BASE`
 * (repo docs/README) are accepted so either wiring works.
 */
const env = import.meta.env as Record<string, string | undefined>

export const API_BASE = (
  env.VITE_API_BASE_URL ??
  env.VITE_API_BASE ??
  'http://localhost:8000'
).replace(/\/$/, '')

export const WS_URL =
  env.VITE_WS_URL ?? deriveWsUrl(API_BASE) ?? 'ws://localhost:8000/ws'

function deriveWsUrl(base: string): string {
  try {
    const u = new URL(base)
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
    u.pathname = '/ws'
    return u.toString()
  } catch {
    return 'ws://localhost:8000/ws'
  }
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { signal })
  if (!res.ok) {
    throw new Error(`GET ${path} failed: ${res.status}`)
  }
  return (await res.json()) as T
}

async function postJson<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    throw new Error(`POST ${path} failed: ${res.status}`)
  }
  return (await res.json()) as T
}

export const api = {
  getDevices: (signal?: AbortSignal) =>
    getJson<{ devices: Device[] }>('/api/devices', signal),

  getDevice: (deviceId: string, signal?: AbortSignal) =>
    getJson<{ device: Device }>(`/api/devices/${deviceId}`, signal),

  getRoom: (room: RoomId, signal?: AbortSignal) =>
    getJson<RoomDetail>(`/api/rooms/${room}`, signal),

  getSummary: (signal?: AbortSignal) =>
    getJson<Summary>('/api/summary', signal),

  getAlerts: (signal?: AbortSignal) =>
    getJson<{ alerts: Alert[] }>('/api/alerts', signal),

  /** Recent power history for the live trend chart. */
  getHistory: (minutes: number, signal?: AbortSignal) =>
    getJson<HistoryResponse>(`/api/history?minutes=${minutes}`, signal),

  /** Backend liveness (server, database, simulator). */
  getHealth: (signal?: AbortSignal) => getJson<HealthStatus>('/health', signal),

  /** Current demo-control state (clock override + simulator). */
  getDemoState: (signal?: AbortSignal) =>
    getJson<DemoState>('/api/demo/state', signal),

  /**
   * Optional demo helper. Flips one device. The dashboard treats this as
   * best-effort — the resulting truth still arrives via the next snapshot,
   * so we don't optimistically mutate local state.
   */
  toggleDevice: async (deviceId: string): Promise<boolean> => {
    try {
      await postJson(`/api/devices/${deviceId}/toggle`)
      return true
    } catch {
      return false
    }
  },

  /** Set a device to an explicit on/off state. */
  setDeviceState: async (
    deviceId: string,
    status: DeviceStatus,
  ): Promise<boolean> => {
    try {
      await postJson(`/api/devices/${deviceId}/state`, { status })
      return true
    } catch {
      return false
    }
  },

  /** Pause or resume the random simulator (demo control). */
  setSimulator: (running: boolean) =>
    postJson<{ simulator: SimulatorState }>('/api/demo/simulator', { running }),

  /** Override backend time to demo after-hours alerts, or clear with null. */
  setClock: (iso: string | null) =>
    postJson<{ clock: DemoState['clock'] }>('/api/demo/clock', { iso }),
}
