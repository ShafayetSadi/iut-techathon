import type { ReactNode } from 'react'
import { Zap, Power, Gauge, Cpu, TriangleAlert } from 'lucide-react'
import type { Summary } from '../../types/dashboard'
import { formatKwh } from '../../lib/format'

interface Props {
  summary: Summary
  alertCount: number
}

/**
 * Five at-a-glance cards. Total Power is deliberately the loudest; the others
 * stay quiet unless something needs attention (alerts turn orange/red).
 */
export function SummaryCards({ summary, alertCount }: Props) {
  const loadsTotal = 15 // 3 rooms × (2 fans + 3 lights)
  const controllersTotal = 3

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {/* Hero card — Total Power */}
      <div className="col-span-2 flex flex-col justify-between overflow-hidden rounded-2xl border border-cyan/20 bg-gradient-to-br from-cyan/[0.12] to-transparent p-5 lg:col-span-1">
        <div className="flex items-center gap-2 text-cyan">
          <Zap className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wide">
            Total Power
          </span>
        </div>
        <div className="mt-3">
          <span className="tnum text-4xl font-bold leading-none text-ink">
            {Math.round(summary.total_power_w)}
          </span>
          <span className="ml-1 text-lg font-medium text-muted">W</span>
        </div>
      </div>

      <Card
        icon={<Power className="h-4 w-4" />}
        label="Devices ON"
        accent="text-good"
        value={`${summary.load_count_on}`}
        suffix={`/ ${loadsTotal}`}
      />

      <Card
        icon={<Gauge className="h-4 w-4" />}
        label="Today's Usage"
        accent="text-amber"
        value={formatKwh(summary.today_kwh).replace(' kWh', '')}
        suffix="kWh"
      />

      <Card
        icon={<Cpu className="h-4 w-4" />}
        label="Controllers"
        accent={
          summary.controllers_online < controllersTotal
            ? 'text-warn'
            : 'text-cyan'
        }
        value={`${summary.controllers_online}`}
        suffix={`/ ${controllersTotal} online`}
      />

      {/* Alerts card — escalates color when alerts exist */}
      <div
        className={`flex flex-col justify-between rounded-2xl border p-4 transition ${
          alertCount > 0
            ? 'border-warn/40 bg-warn/10'
            : 'border-hairline bg-surface'
        }`}
      >
        <div
          className={`flex items-center gap-2 ${
            alertCount > 0 ? 'text-warn' : 'text-faint'
          }`}
        >
          <TriangleAlert className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wide">
            Alerts
          </span>
        </div>
        <div className="mt-3 flex items-baseline gap-1">
          <span
            className={`tnum text-2xl font-bold leading-none ${
              alertCount > 0 ? 'text-warn' : 'text-ink'
            }`}
          >
            {alertCount}
          </span>
          <span className="text-xs text-muted">
            {alertCount > 0 ? 'active' : 'all clear'}
          </span>
        </div>
      </div>
    </div>
  )
}

function Card({
  icon,
  label,
  value,
  suffix,
  accent,
}: {
  icon: ReactNode
  label: string
  value: string
  suffix?: string
  accent: string
}) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-hairline bg-surface p-4">
      <div className={`flex items-center gap-2 ${accent}`}>
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="tnum text-2xl font-bold leading-none text-ink">
          {value}
        </span>
        {suffix && <span className="text-xs text-muted">{suffix}</span>}
      </div>
    </div>
  )
}
