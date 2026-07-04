import {
  ShieldCheck,
  Clock,
  MoonStar,
  PlugZap,
  TriangleAlert,
} from 'lucide-react'
import type { Alert, AlertType } from '../../types/dashboard'
import { formatRoomName } from '../../lib/room'
import { formatRelative, formatTimestamp } from '../../lib/format'
import { EmptyState } from './EmptyState'

interface Props {
  alerts: Alert[]
}

const META: Record<
  AlertType,
  { label: string; icon: typeof Clock; tone: 'crit' | 'warn' }
> = {
  after_hours: { label: 'After hours', icon: MoonStar, tone: 'warn' },
  long_on: { label: 'Left on too long', icon: Clock, tone: 'warn' },
  controller_offline: { label: 'Controller offline', icon: PlugZap, tone: 'crit' },
}

export function AlertsPanel({ alerts }: Props) {
  const hasAlerts = alerts.length > 0

  return (
    <section
      className={`flex flex-col rounded-2xl border p-5 backdrop-blur transition ${
        hasAlerts ? 'border-warn/30 bg-warn/[0.06]' : 'border-hairline bg-surface'
      }`}
    >
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TriangleAlert
            className={`h-4 w-4 ${hasAlerts ? 'text-warn' : 'text-faint'}`}
          />
          <h2 className="text-sm font-semibold text-ink">Active Alerts</h2>
        </div>
        {hasAlerts && (
          <span className="rounded-full bg-warn/20 px-2 py-0.5 text-xs font-semibold text-warn">
            {alerts.length}
          </span>
        )}
      </header>

      {!hasAlerts ? (
        <EmptyState
          icon={<ShieldCheck className="h-5 w-5" />}
          title="All clear"
          message="No active energy issues right now. Every room is behaving."
        />
      ) : (
        <ul className="scroll-thin mt-4 max-h-[22rem] space-y-2.5 overflow-y-auto pr-1">
          {alerts.map((alert) => {
            const meta = META[alert.type] ?? {
              label: alert.type,
              icon: TriangleAlert,
              tone: 'warn' as const,
            }
            const Icon = meta.icon
            const crit = meta.tone === 'crit'
            return (
              <li
                key={alert.id}
                className={`animate-rise rounded-xl border p-3 ${
                  crit
                    ? 'border-crit/40 bg-crit/10'
                    : 'border-warn/30 bg-warn/[0.08]'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ${
                      crit ? 'bg-crit/20 text-crit' : 'bg-warn/20 text-warn'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-xs font-semibold ${
                          crit ? 'text-crit' : 'text-warn'
                        }`}
                      >
                        {meta.label}
                      </span>
                      <span className="shrink-0 text-[10px] text-faint">
                        {formatRoomName(alert.room)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-snug text-ink">
                      {alert.message}
                    </p>
                    <p
                      className="mt-1.5 tnum text-[11px] text-muted"
                      title={formatTimestamp(alert.timestamp)}
                    >
                      {formatRelative(alert.since)} · seen{' '}
                      {formatTimestamp(alert.timestamp)}
                    </p>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
