import type { Alert, Device, Summary } from '../types/dashboard'

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

export const api = {
  getDevices: (signal?: AbortSignal) =>
    getJson<{ devices: Device[] }>('/api/devices', signal),

  getSummary: (signal?: AbortSignal) =>
    getJson<Summary>('/api/summary', signal),

  getAlerts: (signal?: AbortSignal) =>
    getJson<{ alerts: Alert[] }>('/api/alerts', signal),

  /**
   * Optional demo helper. Flips one device. The dashboard treats this as
   * best-effort — the resulting truth still arrives via the next snapshot,
   * so we don't optimistically mutate local state.
   */
  toggleDevice: async (deviceId: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/api/devices/${deviceId}/toggle`, {
        method: 'POST',
      })
      return res.ok
    } catch {
      return false
    }
  },
}
