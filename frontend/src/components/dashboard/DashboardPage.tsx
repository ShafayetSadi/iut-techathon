import { useEffect, useMemo, useState } from 'react'
import { Fan, Lightbulb, X, Power } from 'lucide-react'
import { useDashboardSocket } from '../../hooks/useDashboardSocket'
import { api } from '../../lib/api'
import { deriveSummary, formatRelative, formatTimestamp, formatWatts } from '../../lib/format'
import { ROOM_ORDER, formatRoomName } from '../../lib/room'
import type { Device, RoomDetail, RoomId, Summary } from '../../types/dashboard'
import { Header } from './Header'
import { ConnectionBanner } from './ConnectionBanner'
import { DemoControls } from './DemoControls'
import { SummaryCards } from './SummaryCards'
import { OfficeLayout } from './OfficeLayout'
import { RoomDevicePanel } from './RoomDevicePanel'
import { PowerConsumption } from './PowerConsumption'
import { PowerTrend } from './PowerTrend'
import { AlertsPanel } from './AlertsPanel'

export function DashboardPage() {
  const { snapshot, connection, usingFallback } = useDashboardSocket()
  const [selected, setSelected] = useState<Device | null>(null)
  const [selectedRoom, setSelectedRoom] = useState<RoomId | null>(null)

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

        <DemoControls />

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
                  onSelectRoom={setSelectedRoom}
                />
              </div>

              <div className="space-y-4">
                <PowerConsumption summary={summary} busiestRoom={busiestRoom} />
                <AlertsPanel alerts={snapshot.alerts} />
              </div>
            </div>

            <PowerTrend minutes={30} />

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
                    onOpenRoom={setSelectedRoom}
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
      {selectedRoom && (
        <RoomModal
          room={selectedRoom}
          onClose={() => setSelectedRoom(null)}
          onSelectDevice={(d) => {
            setSelectedRoom(null)
            setSelected(d)
          }}
        />
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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
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
  // The passed device is the last snapshot value; refetch the authoritative
  // record from the backend so the modal shows the freshest single-device truth.
  const [live, setLive] = useState<Device>(device)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    api
      .getDevice(device.id, controller.signal)
      .then((res) => setLive(res.device))
      .catch(() => {
        /* keep the snapshot value */
      })
    return () => controller.abort()
  }, [device.id])

  const active = live.status === 'on'
  const Icon = live.type === 'fan' ? Fan : Lightbulb

  const run = async (fn: () => Promise<boolean>) => {
    setBusy(true)
    setFailed(false)
    const ok = await fn()
    setBusy(false)
    if (ok) onClose()
    else setFailed(true)
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${live.label} details`}
    >
      <div
        className="animate-rise w-full max-w-sm rounded-2xl border border-hairline bg-base-deep p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl border border-hairline bg-surface">
              <Icon className={`h-6 w-6 ${active ? 'text-cyan' : 'text-slate'}`} />
            </span>
            <div>
              <h3 className="text-base font-semibold text-ink">{live.label}</h3>
              <p className="text-xs text-muted">{formatRoomName(live.room)}</p>
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
              {live.status.toUpperCase()}
            </span>
          </Row>
          <Row label="Power draw">
            <span className="tnum text-ink">{formatWatts(live.power_w)}</span>
          </Row>
          <Row label="Rated power">
            <span className="tnum text-muted">
              {formatWatts(live.power_rated_w)}
            </span>
          </Row>
          <Row label="Last changed">
            <span className="text-ink" title={formatTimestamp(live.last_changed)}>
              {formatRelative(live.last_changed)}
            </span>
          </Row>
          <Row label="Device ID">
            <span className="font-mono text-xs text-muted">{live.id}</span>
          </Row>
        </dl>

        {/* Explicit set-state control → POST /api/devices/{id}/state */}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => run(() => api.setDeviceState(live.id, 'on'))}
            disabled={busy || active}
            className="flex items-center justify-center gap-2 rounded-xl border border-good/30 bg-good/10 py-2.5 text-sm font-medium text-good transition hover:bg-good/20 disabled:opacity-40"
          >
            <Power className="h-4 w-4" /> Turn on
          </button>
          <button
            type="button"
            onClick={() => run(() => api.setDeviceState(live.id, 'off'))}
            disabled={busy || !active}
            className="flex items-center justify-center gap-2 rounded-xl border border-hairline bg-white/5 py-2.5 text-sm font-medium text-ink transition hover:bg-white/10 disabled:opacity-40"
          >
            <Power className="h-4 w-4" /> Turn off
          </button>
        </div>

        {/* Toggle helper → POST /api/devices/{id}/toggle */}
        <button
          type="button"
          onClick={() => run(() => api.toggleDevice(live.id))}
          disabled={busy}
          className="mt-2 w-full rounded-xl border border-cyan/30 bg-cyan/10 py-2 text-sm font-medium text-cyan transition hover:bg-cyan/20 disabled:opacity-50"
        >
          {busy ? 'Sending…' : `Toggle ${live.type}`}
        </button>

        {failed && (
          <p className="mt-2 text-center text-xs text-warn">
            Command failed — the backend rejected the request.
          </p>
        )}
        <p className="mt-2 text-center text-[11px] text-faint">
          Sends to the backend · state updates arrive on the next snapshot
        </p>
      </div>
    </div>
  )
}

/* ------------------------------ Room modal ------------------------------ */

function RoomModal({
  room,
  onClose,
  onSelectDevice,
}: {
  room: RoomId
  onClose: () => void
  onSelectDevice: (device: Device) => void
}) {
  const [detail, setDetail] = useState<RoomDetail | null>(null)
  const [errored, setErrored] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setDetail(null)
    setErrored(false)
    api
      .getRoom(room, controller.signal)
      .then(setDetail)
      .catch(() => setErrored(true))
    return () => controller.abort()
  }, [room])

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${formatRoomName(room)} devices`}
    >
      <div
        className="animate-rise w-full max-w-md rounded-2xl border border-hairline bg-base-deep p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-ink">
              {detail?.display_name ?? formatRoomName(room)}
            </h3>
            <p className="tnum text-xs text-muted">
              {detail
                ? `${formatWatts(detail.power_w)} · ${detail.loads_on}/${detail.device_count} on`
                : errored
                  ? 'Room unavailable'
                  : 'Loading room…'}
            </p>
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

        <ul className="mt-4 space-y-1">
          {detail?.devices.map((d) => {
            const on = d.status === 'on'
            const DIcon = d.type === 'fan' ? Fan : Lightbulb
            return (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => onSelectDevice(d)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-white/5"
                >
                  <DIcon
                    className={`h-4 w-4 shrink-0 ${
                      on
                        ? d.type === 'fan'
                          ? 'text-cyan'
                          : 'text-amber'
                        : 'text-slate'
                    }`}
                  />
                  <span className="flex-1 text-sm text-ink">{d.label}</span>
                  <span
                    className={`tnum text-xs ${on ? 'text-ink' : 'text-faint'}`}
                  >
                    {formatWatts(d.power_w)}
                  </span>
                  <span
                    className={`w-12 shrink-0 rounded-md px-1.5 py-0.5 text-center text-[10px] font-semibold ${
                      on ? 'bg-amber/15 text-amber' : 'bg-white/5 text-faint'
                    }`}
                  >
                    {on ? 'ON' : 'OFF'}
                  </span>
                </button>
              </li>
            )
          })}
          {!detail &&
            !errored &&
            Array.from({ length: 5 }).map((_, i) => (
              <li
                key={i}
                className="h-9 animate-pulse rounded-lg bg-white/[0.03]"
              />
            ))}
        </ul>
        <p className="mt-3 text-center text-[11px] text-faint">
          Fetched from GET /api/rooms/{room}
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
