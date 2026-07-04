import { WifiOff, RefreshCw } from 'lucide-react'
import type { ConnectionState } from '../../types/dashboard'

interface Props {
  connection: ConnectionState
  usingFallback: boolean
}

/**
 * Slim banner shown only when the live socket is not healthy. Last known data
 * stays on screen underneath; this just tells the user it may be stale.
 */
export function ConnectionBanner({ connection, usingFallback }: Props) {
  if (connection === 'live' || connection === 'connecting') return null

  const offline = connection === 'offline'

  return (
    <div
      role="status"
      className={`flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm animate-rise ${
        offline
          ? 'border-crit/40 bg-crit/10 text-crit'
          : 'border-warn/40 bg-warn/10 text-warn'
      }`}
    >
      {offline ? (
        <WifiOff className="h-4 w-4 shrink-0" />
      ) : (
        <RefreshCw className="h-4 w-4 shrink-0 animate-fan-slow" />
      )}
      <span className="font-medium">
        {offline
          ? 'Cannot reach the office stream. Retrying…'
          : 'Live connection dropped — reconnecting. Showing last known state.'}
      </span>
      {usingFallback && (
        <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-ink">
          Using fallback refresh
        </span>
      )}
    </div>
  )
}
