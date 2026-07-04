# Lights, Fans, Discord

Hackathon preliminary-round project for monitoring a small office through one shared backend, a
real-time web dashboard, and a Discord bot.

The fixed office model is:

- 3 rooms: Drawing Room, Work Room 1, Work Room 2.
- Each room has 2 fans and 3 lights.
- Total monitored devices: 15.
- Fans use 60W when on, lights use 15W when on.

## Architecture

```text
Simulated room devices
  -> FastAPI backend + SQLite source of truth
  -> WebSocket snapshots for the React dashboard
  -> REST reads for the Discord bot
```

The backend is the only writer of device state and the only place where power totals, `today_kwh`,
and alerts are computed. The dashboard and Discord bot must read from the backend so they never
disagree.

![High-level system architecture diagram](docs/architecture.png)

## Repository Layout

```text
iut-techathon/
├── backend/       FastAPI + SQLite API + in-process Discord bot
├── frontend/      React + Vite dashboard
├── hardware/      Wokwi ESP32 schematic (concept for one room)
├── docs/          Team plan, architecture, fixed API contract, problem statement
└── README.md
```

The Discord bot now lives inside the backend process at `backend/app/discord.py`. It starts from
FastAPI lifespan when `DISCORD_TOKEN` is configured, and is disabled automatically when the token is
empty so local backend work can still run without Discord credentials.

## Fixed Contract

The team must build against [docs/api-contract.md](docs/api-contract.md). That file defines:

- REST endpoint paths and response wrappers.
- WebSocket `snapshot` shape.
- Device IDs and enum values.
- Alert types: `after_hours`, `long_on`.
- Demo controls for clock override, simulator pause/resume, and manual device state changes.
- Canonical mock JSON fixtures for parallel frontend/bot work.

Do not change public API shapes casually. If the contract changes, update the docs first and tell
the team before anyone continues implementation.

## Run Locally

Backend:

```bash
cd backend
uv sync
cp .env.example .env
uv run python main.py
```

The API runs at `http://localhost:8000`.

To enable the Discord bot, fill these values in `backend/.env` before starting the backend:

- `DISCORD_TOKEN`: Discord bot token.
- `ALERT_CHANNEL_ID`: optional channel ID for proactive alert posts.
- `API_BASE`: backend URL the bot calls, normally `http://localhost:8000` locally.
- `OPENROUTER_API_KEY`: optional LLM key for humanized replies. Without it, commands still answer
  from a deterministic template built from the same backend snapshot.
- `OPENROUTER_MODEL`: optional OpenRouter model override.

The bot uses prefix commands by default:

- `!status`: all-room fan/light status.
- `!room <name>`: one room, such as `!room work1` or `!room drawing room`.
- `!usage`: current total watts and today's estimated kWh.
- `!ask <question>`: free-form office question answered from the live backend snapshot.

Frontend:

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server normally runs at `http://localhost:5173`.

## Key URLs

- Backend health: `GET http://localhost:8000/health`
- API docs: `http://localhost:8000/docs`
- Devices: `GET http://localhost:8000/api/devices`
- Summary: `GET http://localhost:8000/api/summary`
- Alerts: `GET http://localhost:8000/api/alerts`
- WebSocket: `ws://localhost:8000/ws`

## Hardware Schematic

A Wokwi ESP32 schematic for one representative room (1 controller + 2 fans + 3 lights),
showing an electrically sensible relay-driven control design for all five AC loads. The visible
LEDs/motors in Wokwi are stand-ins for real mains appliances. It is a **concept/simulation only**
and does not feed the running app — the live demo uses simulated data in the backend.

![Representative room schematic](hardware/schematic.png)

See [`hardware/README.md`](hardware/README.md) for the pin map, wiring rationale, and how to
open it in Wokwi. The optional sensor shown there is a realism/bonus concept only; live office
power totals for the dashboard and bot come from the backend's simulated device data.

## Team Ownership

- Saima: backend simulator, SQLite state, REST API, WebSocket snapshots, alerts.
- Arif: React dashboard, live panels, power meter, alerts panel, office layout.
- Jifat: in-process Discord bot, command handlers, LLM humanization, proactive alert posts.
- Sadi: API contract, diagrams, circuit schematic, README, integration, demo video.

## Validation Checklist

- `GET /api/devices` returns exactly 15 devices: 6 fans and 9 lights.
- Each room has exactly 2 fans and 3 lights.
- `GET /api/summary.total_power_w` equals the sum of fan/light `power_w`.
- Dashboard updates from `WS /ws` without refresh.
- Bot commands call `POST /api/chat`, which injects the same live backend snapshot used by the
  dashboard before humanizing the reply.
- Demo clock override can trigger an after-hours alert visible in both dashboard and bot.
