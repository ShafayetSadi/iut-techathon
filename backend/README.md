# Backend

FastAPI backend for the Lights, Fans, Discord office monitoring system.

This service owns the SQLite source of truth, simulated device state, power math, alert rules, REST
API, and WebSocket snapshots. The frontend and Discord bot must not compute their own state.

## Requirements

- Python 3.12+
- `uv`

## Setup

```bash
uv sync
```

Optional local environment file:

```bash
cp .env.example .env
```

## Run

```bash
uv run python main.py
```

The API runs at `http://localhost:8000`.

Useful URLs:

- `GET /health`
- `GET /api/devices`
- `GET /api/summary`
- `GET /api/alerts`
- `WS /ws`
- Swagger UI at `http://localhost:8000/docs`

## Device Model

The backend seeds 15 devices into SQLite:

- 3 rooms: `drawing`, `work1`, `work2`.
- Per room: `fan-1`, `fan-2`, `light-1`, `light-2`, `light-3`.
- Fans/lights use `status: "on" | "off"`.
- Only fans and lights are tracked devices.

The public API contract is fixed in `../docs/api-contract.md`.

## Structure

```text
backend/
├── app/
│   ├── main.py          FastAPI app, CORS, routers, WebSocket
│   ├── db.py            SQLite schema, seed data, device reads/writes
│   ├── schemas.py       Pydantic request/response models
│   ├── power.py         Room and office power summaries
│   ├── alerts.py        after_hours and long_on alerts
│   ├── simulator.py     Background tick loop scaffold
│   ├── snapshot.py      Contract-shaped WebSocket snapshot builder
│   ├── ws.py            WebSocket connection manager
│   └── routers/         REST endpoint groups
├── main.py              Local uvicorn entrypoint
├── pyproject.toml
└── uv.lock
```

## Development Checks

Syntax check:

```bash
python3 -m compileall .
```

Backend smoke:

```bash
uv run python - <<'PY'
from app.clock import iso_now
from app.db import get_today_kwh, init_db, get_devices
from app.power import build_summary
from app.snapshot import build_snapshot

init_db()
devices = get_devices()
summary = build_summary(devices, iso_now(), get_today_kwh())
snapshot = build_snapshot()
print(len(devices))
print(summary.keys())
print(snapshot.keys())
PY
```

Expected device counts:

- 15 total devices.
- 6 fans.
- 9 lights.
- 5 devices per room.

## Runtime Files

Local runtime files are ignored:

- `.venv/`
- `office.db`
- `__pycache__/`

Do not commit secrets or local SQLite databases.
