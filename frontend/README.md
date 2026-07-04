# Frontend

React + Vite dashboard for the Lights, Fans, Discord office monitoring system.

The dashboard should render live backend state, not compute its own truth. Use the WebSocket
snapshot as the primary data source and REST polling only as a fallback.

## Requirements

- Node.js 20+
- npm
- Backend running at `http://localhost:8000`

## Setup

```bash
npm install
```

Create a local env file if the backend URL differs from the default (a
ready-to-copy `.env.example` is included):

```bash
cp .env.example .env.local
```

| Variable            | Default                    | Notes                                             |
| ------------------- | -------------------------- | ------------------------------------------------- |
| `VITE_API_BASE_URL` | `http://localhost:8000`    | REST base URL. `VITE_API_BASE` is also accepted.  |
| `VITE_WS_URL`       | `ws://localhost:8000/ws`   | Live snapshot stream. Use `wss://` in production. |

## Run

```bash
npm run dev
```

Vite normally serves the dashboard at `http://localhost:5173`.

## Build and Lint

```bash
npm run build
npm run lint
```

## Backend Contract

Build against `../docs/api-contract.md`.

Important live data shapes:

- `GET /api/devices` returns 15 devices.
- `GET /api/summary` returns total power, per-room summaries, `load_count_on`, and
  `device_count`.
- `GET /api/alerts` returns backend-computed alerts.
- `WS /ws` sends one `snapshot` message with `devices`, `summary`, and `alerts`.

Device rules:

- Each room has 2 fans and 3 lights.
- Fans/lights use `on` and `off`.

## Dashboard Responsibilities

- Connect to `VITE_WS_URL` and render the latest snapshot.
- Show all 15 devices grouped by room.
- Show live total power and per-room power.
- Show active alerts from the backend.
- Reconnect to WebSocket with backoff; poll REST endpoints if WebSocket is unavailable.

Do not recompute alert rules or power totals in React. Display the backend values so the dashboard
and Discord bot stay consistent.

## Architecture

The dashboard keeps a single live `Snapshot` in state and renders every panel from it, so the whole
page is always internally consistent — mirroring the backend's "one source of truth" rule.

```text
src/
  components/dashboard/   # Header, SummaryCards, OfficeLayout, RoomDevicePanel,
                          # DeviceIndicator, PowerConsumption, AlertsPanel,
                          # ConnectionBanner, EmptyState, DashboardPage
  hooks/
    useDashboardSocket.ts   # primary WebSocket client + exponential-backoff reconnect
    useDashboardFallback.ts # REST polling used only while the socket is down
  lib/
    api.ts      # env-driven URLs + typed REST client
    format.ts   # formatWatts / formatKwh / formatTimestamp + safe summary fallback
    room.ts     # room key → display name (the only hardcoded business data)
  types/
    dashboard.ts  # typed mirror of docs/api-contract.md
```

Connection states surfaced to the user: **Connecting → Live → Reconnecting (fallback) → Offline**.
Last known data stays on screen during reconnects.

## Project Scripts

```bash
npm run dev      # start Vite dev server
npm run build    # type-check and build production assets
npm run lint     # run Oxlint
npm run preview  # serve built assets locally
```
