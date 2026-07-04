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

The Discord bot is optional. Leave `DISCORD_TOKEN` empty to run only the API and simulator. Fill it
in to start the bot from the same FastAPI process.

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
- `POST /api/chat`
- `WS /ws`
- Swagger UI at `http://localhost:8000/docs`

## Discord Bot

The bot lives in `app/discord.py` and is started from `app/main.py` during FastAPI lifespan. It does
not keep its own device state. Each command posts a question to `POST /api/chat`; that route builds
the current backend snapshot (`devices`, `summary`, `alerts`) and sends it through `app/llm.py` for
OpenRouter humanization or a deterministic template fallback.

Commands:

- `!status` - status of all rooms.
- `!room <name>` - one room; accepts aliases such as `drawing room`, `work1`, `work room 2`, `w2`.
- `!usage` - current total power and today's estimated kWh.
- `!ask <question>` - free-form office question, still answered only from live backend data.

Environment:

- `DISCORD_TOKEN` enables the bot.
- `BOT_COMMAND_PREFIX` defaults to `!`.
- `API_BASE` defaults to `http://localhost:8000`.
- `ALERT_CHANNEL_ID` enables proactive alert posts.
- `ALERT_POLL_SECONDS` defaults to `15`.
- `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, and `OPENROUTER_BASE_URL` configure optional LLM
  humanization. If the key is absent or the model call fails, replies still use real backend data
  via the template fallback.

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
│   ├── discord.py       in-process discord.py bot and proactive alert poller
│   ├── llm.py           OpenRouter humanization with template fallback
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
