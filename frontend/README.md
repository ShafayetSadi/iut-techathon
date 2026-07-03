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

Create a local env file if the backend URL differs from the default:

```bash
printf 'VITE_API_BASE=http://localhost:8000\nVITE_WS_URL=ws://localhost:8000/ws\n' > .env.local
```

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

- `GET /api/devices` returns 18 devices.
- `GET /api/summary` returns total power, per-room summaries, `load_count_on`, and
  `controllers_online`.
- `GET /api/alerts` returns backend-computed alerts.
- `WS /ws` sends one `snapshot` message with `devices`, `summary`, and `alerts`.

Device rules:

- Each room has 2 fans, 3 lights, and 1 controller.
- Fans/lights use `on` and `off`.
- Controllers use `online` and `offline`.
- Controllers do not count toward power usage.

## Dashboard Responsibilities

- Connect to `VITE_WS_URL` and render the latest snapshot.
- Show all 18 devices grouped by room.
- Show live total power and per-room power.
- Show active alerts from the backend.
- Visually distinguish fan/light state from controller online/offline state.
- Reconnect to WebSocket with backoff; poll REST endpoints if WebSocket is unavailable.

Do not recompute alert rules or power totals in React. Display the backend values so the dashboard
and Discord bot stay consistent.

## Project Scripts

```bash
npm run dev      # start Vite dev server
npm run build    # type-check and build production assets
npm run lint     # run Oxlint
npm run preview  # serve built assets locally
```
