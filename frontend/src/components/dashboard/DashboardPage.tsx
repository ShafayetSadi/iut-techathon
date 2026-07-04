import { useMemo, useState } from 'react'
import { Fan, Lightbulb, Cpu, X, Power } from 'lucide-react'
import { useDashboardSocket } from '../../hooks/useDashboardSocket'
import { api } from '../../lib/api'
import { deriveSummary, formatRelative, formatTimestamp, formatWatts } from '../../lib/format'
import { ROOM_ORDER, formatRoomName } from '../../lib/room'
import type { Device, RoomId, Summary } from '../../types/dashboard'
import { Header } from './Header'
import { ConnectionBanner } from './ConnectionBanner'
import { SummaryCards } from './SummaryCards'
import { OfficeLayout } from './OfficeLayout'
import { RoomDevicePanel } from './RoomDevicePanel'
import { PowerConsumption } from './PowerConsumption'
import { AlertsPanel } from './AlertsPanel'

export function DashboardPage() {
  const { snapshot, connection, usingFallback } = useDashboardSocket()
  const [selected, setSelected] = useState<Device | null>(null)

  // Backend summary is the source of truth; derive one only if it's missing.
  const summary: Summary | null = useMemo(() => {
    if (!snapshot) return null
    return snapshot.summary ?? deriveSummary(snapshot.devices, snapshot.server_time)
  }, [snapshot])

  const busiestRoom: RoomId | null = useMemo(() => {
    if (!summary) return null
    let best: RoomId | null = null
    let max = 0
    for (const room of ROOM_ORDER) {
      const p = summary.per_room[room]?.power_w ?? 0
      if (p > max) {
        max = p
        best = room
      }
    }
    return best
  }, [summary])

  const devicesByRoom = useMemo(() => {
    const map: Record<RoomId, Device[]> = { drawing: [], work1: [], work2: [] }
    if (snapshot) for (const d of snapshot.devices) map[d.room]?.push(d)
    return map
  }, [snapshot])

  const showSkeleton = !snapshot || !summary

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 sm:py-7">
      <Header
        connection={connection}
        usingFallback={usingFallback}
        serverTime={snapshot?.server_time}
      />

      <div className="mt-4 space-y-4">
        <ConnectionBanner connection={connection} usingFallback={usingFallback} />

        {showSkeleton ? (
          <LoadingState connection={connection} />
        ) : (
          <>
            <SummaryCards summary={summary} alertCount={snapshot.alerts.length} />

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <OfficeLayout
                  devices={snapshot.devices}
                  summary={summary}
                  busiestRoom={busiestRoom}
                  onSelect={setSelected}
                />
              </div>

              <div className="space-y-4">
                <PowerConsumption summary={summary} busiestRoom={busiestRoom} />
                <AlertsPanel alerts={snapshot.alerts} />
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-baseline gap-2">
                <h2 className="text-sm font-semibold tracking-wide text-ink">
                  Room Details
                </h2>
                <span className="text-xs text-faint">
                  Every device, per room
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {ROOM_ORDER.map((room) => (
                  <RoomDevicePanel
                    key={room}
                    room={room}
                    devices={devicesByRoom[room]}
                    summary={summary.per_room[room]}
                    onSelect={setSelected}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        <Footer />
      </div>

      {selected && (
        <DeviceModal device={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

/* --------------------------- Loading skeleton --------------------------- */

function LoadingState({ connection }: { connection: string }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {connection === 'offline'
          ? 'Cannot reach the office stream. Retrying…'
          : 'Connecting to office stream…'}
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-2xl border border-hairline bg-surface"
          />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-72 animate-pulse rounded-2xl border border-hairline bg-surface lg:col-span-2" />
        <div className="h-72 animate-pulse rounded-2xl border border-hairline bg-surface" />
      </div>
    </div>
  )
}

/* ----------------------------- Device modal ----------------------------- */

function DeviceModal({
  device,
  onClose,
}: {
  device: Device
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const isController = device.type === 'controller'
  const active = device.status === 'on' || device.status === 'online'

  const toggle = async () => {
    setBusy(true)
    setFailed(false)
    const ok = await api.toggleDevice(device.id)
    if (!ok) setFailed(true)
    setBusy(false)
    // Truth arrives via the next snapshot; close on success.
    if (ok) onClose()
  }

  const Icon = isController ? Cpu : device.type === 'fan' ? Fan : Lightbulb

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${device.label} details`}
    >
      <div
        className="animate-rise w-full max-w-sm rounded-2xl border border-hairline bg-base-deep p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl border border-hairline bg-surface">
              <Icon
                className={`h-6 w-6 ${
                  active ? 'text-cyan' : 'text-slate'
                }`}
              />
            </span>
            <div>
              <h3 className="text-base font-semibold text-ink">
                {device.label}
              </h3>
              <p className="text-xs text-muted">{formatRoomName(device.room)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-white/10 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <dl className="mt-4 space-y-2 text-sm">
          <Row label="Status">
            <span className={active ? 'text-good' : 'text-faint'}>
              {device.status.toUpperCase()}
            </span>
          </Row>
          <Row label="Power draw">
            <span className="tnum text-ink">{formatWatts(device.power_w)}</span>
          </Row>
          <Row label="Rated power">
            <span className="tnum text-muted">
              {formatWatts(device.power_rated_w)}
            </span>
          </Row>
          <Row label="Last changed">
            <span
              className="text-ink"
              title={formatTimestamp(device.last_changed)}
            >
              {formatRelative(device.last_changed)}
            </span>
          </Row>
          <Row label="Device ID">
            <span className="font-mono text-xs text-muted">{device.id}</span>
          </Row>
        </dl>

        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-cyan/30 bg-cyan/10 py-2.5 text-sm font-medium text-cyan transition hover:bg-cyan/20 disabled:opacity-50"
        >
          <Power className="h-4 w-4" />
          {busy ? 'Sending…' : `Toggle ${isController ? 'controller' : device.type}`}
        </button>
        {failed && (
          <p className="mt-2 text-center text-xs text-warn">
            Toggle unavailable — this is a read-only demo control.
          </p>
        )}
        <p className="mt-2 text-center text-[11px] text-faint">
          Sends to the backend · state updates arrive on the next snapshot
        </p>
      </div>
    </div>
  )
}

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between border-b border-hairline/60 pb-2">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  )
}

/* -------------------------------- Footer -------------------------------- */

function Footer() {
  return (
    <footer className="flex items-center justify-center gap-2 pt-2 text-center text-xs text-faint">
      <span className="h-1.5 w-1.5 rounded-full bg-good" />
      Dashboard synced from shared backend source of truth
    </footer>
  )
}
