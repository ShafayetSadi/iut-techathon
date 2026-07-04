import { Activity } from 'lucide-react'
import type { ConnectionState } from '../../types/dashboard'
import { formatTimestamp } from '../../lib/format'

interface Props {
  connection: ConnectionState
  usingFallback: boolean
  serverTime?: string
}

const LABEL: Record<ConnectionState, string> = {
  connecting: 'Connecting',
  live: 'Live',
  reconnecting: 'Reconnecting',
  offline: 'Offline',
}

export function Header({ connection, usingFallback, serverTime }: Props) {
  const live = connection === 'live'
  const offline = connection === 'offline'

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl border border-hairline bg-surface">
          <Activity className="h-6 w-6 text-cyan" strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-ink sm:text-xl">
            Office Energy Command
          </h1>
          <p className="text-xs text-muted sm:text-sm">
            Live monitoring for every light and fan across the office
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 self-start sm:self-auto">
        <div className="flex items-center gap-2 rounded-full border border-hairline bg-surface px-3 py-1.5">
          <span
            className={`relative h-2.5 w-2.5 rounded-full ${dotColor(
              connection,
            )} ${live ? 'animate-live' : ''}`}
          />
          <span
            className={`text-xs font-medium ${
              offline ? 'text-crit' : live ? 'text-cyan' : 'text-warn'
            }`}
          >
            {LABEL[connection]}
            {usingFallback ? ' · fallback' : ''}
          </span>
        </div>
        <div className="hidden text-right sm:block">
          <p className="text-[10px] uppercase tracking-wide text-faint">
            Last updated
          </p>
          <p className="tnum text-xs text-muted">
            {serverTime ? formatTimestamp(serverTime) : '—'}
          </p>
        </div>
      </div>
    </header>
  )
}

function dotColor(state: ConnectionState): string {
  switch (state) {
    case 'live':
      return 'bg-cyan'
    case 'reconnecting':
    case 'connecting':
      return 'bg-warn'
    case 'offline':
      return 'bg-crit'
  }
}
