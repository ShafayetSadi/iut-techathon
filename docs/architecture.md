# Architecture — "Lights, Fans, Discord" Office Monitoring System

> Technical blueprint for the whole team. Every component is built against this document so the
> independently-developed pieces integrate on the first try. For **who** builds what and the
> schedule, see [`TEAM_PLAN.md`](./TEAM_PLAN.md). This doc is the **what** and **how**.

---

## 1. Guiding Principle — One Source of Truth

The single hard rule of the challenge: the dashboard and the Discord bot must **never disagree**.
We enforce this by giving the system exactly one place where device state lives — the **SQLite
database** — and making every other component a _reader_ of it.

```text
                 ┌──────────────────────────────────────────────┐
                 │                 BACKEND (FastAPI)             │
                 │                                              │
   tick loop ──▶ │  Simulator ──writes──▶ ┌──────────────┐     │
   (every 3s)    │                        │   SQLite DB  │     │
                 │  Alerts engine ◀─reads─┤ (SOURCE OF   │     │
                 │                        │   TRUTH)     │     │
                 │  REST + WS layer ◀────┤              │     │
                 │        │               └──────────────┘     │
                 └────────┼──────────────────────────────────────┘
                          │
              ┌───────────┴────────────┐
        WebSocket push          REST pull
      (live snapshot)        (on-demand reads)
              │                        │
              ▼                        ▼
    ┌───────────────────┐    ┌───────────────────┐
    │  WEB DASHBOARD    │    │   DISCORD BOT     │
    │  (React, Vercel)  │    │  (discord.py)     │
    │  live panels +    │    │  !status !room    │
    │  trend chart +    │    │  !usage + LLM +   │
    │  office layout    │    │  proactive alerts │
    └───────────────────┘    └───────────────────┘
              │                        │
              ▼                        ▼
            Boss                  Boss (in Discord)
```

Flow in one line: **Simulator → SQLite → API → (WebSocket) Web UI && (REST) Discord Bot → User.**

---

## 2. Component Responsibilities

| Component                  | Owns                                                                                                                                                        | Never does                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Backend** (`/backend`)   | Simulating device state, persisting it, computing power totals + `kWh`, running the alerts engine, exposing REST + WebSocket. **The only writer of state.** | Rendering UI; talking to Discord; calling the LLM.                            |
| **Frontend** (`/frontend`) | Rendering live panels, trend chart, animated office layout. Reads via WebSocket (with REST fallback).                                                       | Computing alerts or power itself — it only _displays_ what the backend sends. |
| **Bot** (`/bot`)           | Answering Discord commands, humanizing answers via LLM, proactively posting new alerts. Reads via REST.                                                     | Holding its own copy of device state; inventing data.                         |
| **Hardware** (`/hardware`) | Wokwi ESP32 schematic proving the sensing concept for one room.                                                                                             | Feeding the running app (it's a concept/simulation only).                     |

**Boundary rule:** power math and alert logic live **only** in the backend. If the bot or
dashboard ever needs a number, the backend provides it. This is what keeps the two interfaces in
sync.

---

## 3. Tech Stack

| Layer             | Choice                                | Why                                                                                                                  |
| ----------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Backend framework | **FastAPI** (Python)                  | Async, native WebSocket support, auto OpenAPI docs at `/docs`, minimal boilerplate.                                  |
| Persistence       | **SQLite** + **SQLAlchemy**           | Zero-config file DB = single source of truth; SQLAlchemy gives clean models + easy migration to Postgres if we host. |
| Background work   | FastAPI `lifespan` + `asyncio` task   | The simulator tick loop runs in-process; no extra worker/broker needed.                                              |
| Frontend          | **React + Vite + TypeScript**         | Fast dev server, typed API contract, easy Vercel deploy.                                                             |
| Charts            | **Recharts**                          | Simple declarative line chart for the power trend.                                                                   |
| Bot               | **discord.py**                        | Mature, supports both slash and prefix commands, easy `tasks.loop` for the alert poller.                             |
| LLM               | **Anthropic SDK**, `claude-haiku-4-5` | Fast + cheap for conversational humanizing of real data.                                                             |
| HTTP client (bot) | **httpx**                             | Async calls to the backend REST API.                                                                                 |

> All choices are free-tier friendly and deployable. See §14 for hosting.

---

## 4. Repository Layout

```text
iut-techathon/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app, lifespan starts the tick loop
│   │   ├── db.py              # SQLAlchemy engine/session, init + seed
│   │   ├── models.py          # Device, StateEvent ORM models
│   │   ├── schemas.py         # Pydantic response models (the API contract)
│   │   ├── simulator.py       # tick loop: flips devices, writes DB, logs history
│   │   ├── power.py           # totals, per-room, today's kWh
│   │   ├── alerts.py          # alerts engine (after-hours, long-on-room)
│   │   ├── clock.py           # now() with demo override (fake "10 PM")
│   │   ├── ws.py              # WebSocket connection manager + broadcast
│   │   └── routers/
│   │       ├── devices.py     # /api/devices, /api/rooms, /api/devices/{id}/toggle
│   │       ├── summary.py     # /api/summary, /api/history
│   │       └── alerts.py      # /api/alerts
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── hooks/useLiveData.ts   # WS subscribe + REST fallback → single snapshot
│   │   ├── api.ts                 # typed REST client
│   │   ├── components/
│   │   │   ├── DeviceStatusPanel.tsx
│   │   │   ├── PowerMeter.tsx
│   │   │   ├── PowerTrendChart.tsx
│   │   │   ├── AlertsPanel.tsx
│   │   │   └── OfficeLayout.tsx    # animated SVG floor plan
│   │   └── App.tsx
│   ├── package.json
│   └── .env.example
├── bot/
│   ├── bot.py                # command handlers + alert poller
│   ├── backend_client.py     # httpx calls to the API
│   ├── llm.py                # Claude humanization
│   ├── requirements.txt
│   └── .env.example
├── hardware/
│   └── wokwi/                # diagram.json, sketch.ino, screenshot, share link
├── docs/
│   ├── TEAM_PLAN.md
│   ├── architecture.md       # ← this file
│   ├── api-contract.md       # trimmed copy of §8 for quick reference
│   ├── system-diagram.png    # the submitted (non-Mermaid) diagram
│   └── Hackathon Problem Statement (Preliminary Round).pdf
└── README.md
```

---

## 5. Data Model (SQLite)

Two tables. `devices` is the **live state**; `state_events` is the **append-only history** that
powers the trend chart and lets us survive restarts.

### `devices`

| Column          | Type                | Notes                                 |
| --------------- | ------------------- | ------------------------------------- |
| `id`            | TEXT PK             | Deterministic, e.g. `work1-fan-1`     |
| `type`          | TEXT                | `fan` \| `light` \| `controller`      |
| `label`         | TEXT                | `Fan 1`, `Light 3`                    |
| `room`          | TEXT                | `drawing` \| `work1` \| `work2`       |
| `status`        | TEXT                | Fans/lights: `on` \| `off`; controllers: `online` \| `offline` |
| `power_rated_w` | INT                 | Rated draw when ON (fan 60, light 15, controller 0) |
| `last_changed`  | TEXT (ISO 8601 UTC) | Updated only when `status` flips      |

`power_w` in responses is **derived**: fans/lights use `power_rated_w if status=='on' else 0`;
controllers always return `0`. We store the rated value, not the current one, so there's a single
truth.

### `state_events` (history)

| Column          | Type                | Notes                             |
| --------------- | ------------------- | --------------------------------- |
| `id`            | INT PK autoincr     |                                   |
| `ts`            | TEXT (ISO 8601 UTC) | When the sample was taken         |
| `total_power_w` | INT                 | Whole-office draw at that instant |
| `loads_on`      | INT                 | Count of ON fans/lights           |

The simulator appends one `state_events` row **every tick** (a lightweight time-series). `GET
/api/history` reads the last N rows for the chart. `today_kwh` is computed by integrating these
samples over the current day.

### Seed (runs once on empty DB)

18 devices, generated deterministically:

```text
rooms   = ["drawing", "work1", "work2"]
per room: fan-1, fan-2 (60W each), light-1, light-2, light-3 (15W each), controller-1 (0W)
id      = f"{room}-{type}-{n}"      e.g. "drawing-light-2"
label   = f"{Type} {n}"             e.g. "Light 2"
```

Initial states are randomized so the dashboard has something live immediately.

---

## 6. Backend Internal Architecture

Layered, single-process. The tick loop is the heartbeat.

```text
FastAPI lifespan (startup)
   └─ init_db() → create tables, seed 18 devices if empty
   └─ launch asyncio task: simulator_loop()

simulator_loop()  ── every TICK_SECONDS (default 3s) ──▶
   1. maybe_flip_devices()   # flip a *few* random devices, update last_changed
   2. sample = compute_power_snapshot()   # power.py
   3. append StateEvent(sample)           # history
   4. alerts = recompute_alerts()         # alerts.py, uses clock.now()
   5. snapshot = build_snapshot()         # devices + summary + alerts
   6. await ws_manager.broadcast(snapshot)

REST routers  ── on request ──▶ read DB → build the same schema objects
```

Key modules:

- **`clock.py`** — `now()` returns real UTC unless `DEMO_NOW` env/override is set (e.g.
  `2026-07-03T22:00:00`). This is how we demo after-hours alerts on camera without waiting until
  night. There is also `POST /api/demo/clock` to set/clear it live during the video.
- **`simulator.py`** — flips at most ~2–3 devices per tick with weighted probability (devices are
  more likely to be ON during office hours) so the data looks realistic, not random noise.
- **`power.py`** — pure functions: `total_power()`, `per_room_power()`, `today_kwh()`. No side
  effects; both the tick loop and REST handlers call these.
- **`ws.py`** — `ConnectionManager` holding a set of live sockets; `broadcast()` serializes the
  snapshot once and sends to all, dropping dead connections.

---

## 7. API Contract

Base URL: `${API_BASE}` (e.g. `http://localhost:8000` in dev, the Render URL in prod).
All timestamps are **ISO 8601 UTC**. All responses are JSON.

### Device object (canonical shape everywhere)

```json
{
  "id": "work1-fan-1",
  "type": "fan",
  "label": "Fan 1",
  "room": "work1",
  "status": "on",
  "power_w": 60,
  "last_changed": "2026-07-03T14:22:10Z"
}
```

### REST endpoints

| Method | Path                       | Returns                                                                     |
| ------ | -------------------------- | --------------------------------------------------------------------------- |
| GET    | `/api/devices`             | `{ "devices": [Device, …18] }`                                              |
| GET    | `/api/rooms/{room}`        | `{ "room": "work1", "devices": [...], "power_w": 135, "loads_on": 3, "controllers_online": 1 }` |
| GET    | `/api/summary`             | see below                                                                   |
| GET    | `/api/history?minutes=30`  | `{ "points": [{ "ts": "...", "total_power_w": 375, "loads_on": 10 }, ...] }` |
| GET    | `/api/alerts`              | `{ "alerts": [Alert, …] }`                                                  |
| POST   | `/api/devices/{id}/toggle` | flips one device (demo helper) → updated `Device`                           |
| POST   | `/api/demo/clock`          | body `{ "iso": "2026-07-03T22:00:00Z" }` or `{ "iso": null }` to reset      |

`GET /api/summary`:

```json
{
  "total_power_w": 375,
  "per_room": {
    "drawing": { "power_w": 75, "loads_on": 2, "controllers_online": 1 },
    "work1": { "power_w": 135, "loads_on": 3, "controllers_online": 1 },
    "work2": { "power_w": 165, "loads_on": 5, "controllers_online": 1 }
  },
  "today_kwh": 4.2,
  "load_count_on": 10,
  "controllers_online": 3,
  "device_count": 18,
  "server_time": "2026-07-03T14:22:10Z"
}
```

`Alert` object:

```json
{
  "id": "afterhours-work2-2026-07-03T22:00",
  "type": "after_hours", // "after_hours" | "long_on" | "controller_offline"
  "room": "work2",
  "message": "Work Room 2 has 2 fans and 3 lights ON at 10:00 PM.",
  "since": "2026-07-03T22:00:00Z",
  "timestamp": "2026-07-03T22:00:03Z"
}
```

### WebSocket `/ws`

On connect, the server immediately sends one snapshot, then re-sends on every tick. **One message
type**, so clients stay simple:

```json
{
  "type": "snapshot",
  "server_time": "2026-07-03T14:22:10Z",
  "devices": [ Device, … ],
  "summary": { …same as /api/summary… },
  "alerts": [ Alert, … ]
}
```

**Client rules (frontend):**

- Keep the latest snapshot in a single state object; render everything from it.
- Reconnect with exponential backoff on close.
- If WS is unavailable, fall back to polling `GET /api/summary` + `/api/devices` + `/api/alerts`
  every 3s. Same data, so UI code doesn't branch.

> Keep `docs/api-contract.md` as a trimmed copy of this section so Arif and Jifat don't scroll the
> whole doc. If the contract changes, this section is the source of truth.

---

## 8. Alerts Engine

Runs every tick in `alerts.py`, using `clock.now()` (so the demo override works).

### Rules

1. **After-hours** (`after_hours`) — office hours are **09:00–17:00** local. If `now` is outside
   that window and _any_ fan/light in a room is ON, emit one alert per offending room.
2. **Long-on room** (`long_on`) — if **all 5 fans/lights** in a room have been continuously ON for
   **> 2 hours**, emit an alert for that room. "Continuously" is tracked from the _oldest_
   `last_changed` among the room's fans/lights while all are ON.
3. **Controller offline** (`controller_offline`) — if a room controller is offline, emit an alert
   for that room.

### Lifecycle & dedup

- Alert `id` is deterministic (`{type}-{room}-{hour-bucket}`) so the same ongoing condition keeps
  the same id across ticks → the bot won't re-spam and the dashboard won't flicker.
- An alert disappears from `/api/alerts` the moment its condition clears.
- The **bot** tracks which alert ids it has already announced (in memory) and only posts _newly
  seen_ ids.
- Every alert carries `since` (when the condition began) and `timestamp` (when last observed).

---

## 9. Frontend Architecture

```text
App
├── useLiveData()                # WS subscribe → { devices, summary, alerts, connected }
├── <Header/>                    # office name + live/disconnected indicator + clock
├── <PowerMeter/>                # big total watts + per-room bars (from summary)
├── <PowerTrendChart/>           # Recharts line from GET /api/history, appends WS samples
├── <DeviceStatusPanel/>         # 18 devices grouped by room, on/off pill each
├── <AlertsPanel/>               # alerts list, timestamped, color-coded by type
└── <OfficeLayout/>              # SVG top-view; lights glow, fans spin when ON  (BONUS)
```

- **Single snapshot in state.** `useLiveData` owns the one snapshot; components are pure and read
  from props. No component fetches on its own — this guarantees the whole page is internally
  consistent (mirrors the "one source of truth" rule on the client).
- **Trend chart** seeds from `/api/history?minutes=30` on mount, then pushes each incoming WS
  `summary.total_power_w` onto a rolling window.
- **OfficeLayout** maps each device id to an SVG element; `status==='on'` toggles a CSS class
  (`.glow` for lights, `.spin` keyframe for fans). Layout mirrors the PDF floor plan.
- **Real-time proof:** the whole UI updates with no page refresh (WS-driven). This is an explicit
  grading requirement — never gate updates behind a manual reload.

---

## 10. Discord Bot Architecture

```text
bot.py
├── on_ready → start alert_poller (tasks.loop, every 15s)
├── command: status  → backend_client.get_summary() + get_devices() → llm.humanize() → reply
├── command: room <name> → backend_client.get_room(name) → llm.humanize() → reply
├── command: usage  → backend_client.get_summary() → llm.humanize() → reply
└── alert_poller → backend_client.get_alerts() → for each NEW id → post to ALERT_CHANNEL_ID
```

- **`backend_client.py`** — thin async httpx wrapper over the REST API. The bot holds **no** device
  state; it always fetches fresh. This is why the bot and dashboard can never disagree.
- **Commands** support both `!status` prefix and `/status` slash form (pick one for the demo; keep
  both wired if cheap).
- **`alert_poller`** — keeps a `set()` of announced alert ids; posts only ids not seen before, e.g.
  `⚠️ Work Room 2 still has 2 fans and 3 lights ON and it's 10 PM. Did someone forget to leave?`

---

## 11. LLM Integration (humanized answers)

The bot must give **real answers from real data**, just phrased conversationally — never invent
numbers.

**Design (`llm.py`):**

- Model: `claude-haiku-4-5` (fast, cheap, plenty for this).
- **System prompt** fixes persona + hard guardrail: _"You are the office's friendly energy
  assistant. Answer ONLY from the JSON data provided. Never invent devices, rooms, or numbers. Be
  concise and warm. If a value isn't in the data, say you don't have it."_
- **User content** = the user's question + the freshly-fetched JSON (summary/devices/room) as
  context.
- The LLM only _rephrases_ — the truth is always the injected JSON. If the Anthropic call fails,
  fall back to a plain templated string built from the same data (so the bot never goes silent).

```text
question ─▶ backend_client (fetch real JSON) ─▶ llm.humanize(question, json)
                                                     │ fail?
                                                     └─▶ template_fallback(json)
```

> Use the latest Anthropic SDK; the API key lives in `bot/.env` (`ANTHROPIC_API_KEY`), never in
> git. Confirm exact model id/params against current Anthropic docs before wiring.

---

## 12. Configuration & Environments

Each component ships a `.env.example`. Never commit real secrets.

**`backend/.env`**

| Var                            | Dev                     | Prod                                      | Purpose                      |
| ------------------------------ | ----------------------- | ----------------------------------------- | ---------------------------- |
| `DATABASE_URL`                 | `sqlite:///./office.db` | `sqlite:///./office.db` (or Postgres URL) | DB location                  |
| `TICK_SECONDS`                 | `3`                     | `3`                                       | Simulator/broadcast interval |
| `CORS_ORIGINS`                 | `http://localhost:5173` | `https://<app>.vercel.app`                | Allowed frontend origins     |
| `OFFICE_OPEN` / `OFFICE_CLOSE` | `09:00` / `17:00`       | same                                      | Office hours for alerts      |

**`frontend/.env`**

| Var             | Dev                      | Prod                              |
| --------------- | ------------------------ | --------------------------------- |
| `VITE_API_BASE` | `http://localhost:8000`  | `https://<backend>.onrender.com`  |
| `VITE_WS_URL`   | `ws://localhost:8000/ws` | `wss://<backend>.onrender.com/ws` |

**`bot/.env`**

| Var                 | Purpose                      |
| ------------------- | ---------------------------- |
| `DISCORD_TOKEN`     | Bot token                    |
| `ALERT_CHANNEL_ID`  | Channel for proactive alerts |
| `API_BASE`          | Backend base URL             |
| `ANTHROPIC_API_KEY` | LLM key                      |

---

## 13. Deployment Architecture

Three independently-deployed pieces, wired by URLs + CORS.

```text
   Vercel                     Render/Railway                 Always-on host
 ┌──────────┐   HTTPS/WSS   ┌──────────────────┐           ┌──────────────┐
 │ Frontend │ ────────────▶ │  Backend (API +  │ ◀──────── │  Discord Bot │
 │ (static) │               │  WS + SQLite)    │  HTTPS    │  (worker)    │
 └──────────┘               └──────────────────┘           └──────────────┘
        │                            ▲                             │
        └─ VITE_API_BASE/WS_URL ─────┘        API_BASE ────────────┘
```

- **Backend → Render or Railway** (web service). Exposes HTTPS + WSS. SQLite file lives on the
  instance disk (add a persistent volume on Render if we want history to survive redeploys; fine
  without for the demo).
- **Frontend → Vercel** (static build). Set `VITE_API_BASE` + `VITE_WS_URL` to the backend URL.
- **Bot → Railway/Render background worker** (or a small VPS). Set `API_BASE` to the backend URL.
- **CORS:** backend `CORS_ORIGINS` must include the exact Vercel domain. WSS works cross-origin;
  double-check the browser uses `wss://` (not `ws://`) in prod or it will be blocked as mixed
  content.
- **Secrets** only via each host's env-var settings, never in the repo.

For the recorded demo, running all three locally is acceptable too — but a live public dashboard
URL is a strong flex for judges.

---

## 14. Key Sequence Flows

### A. After-hours alert (the money shot for the demo)

```text
Presenter: POST /api/demo/clock { iso: "…T22:00:00Z" }
tick loop → alerts.recompute() sees devices ON at 22:00
   → new Alert(after_hours, work2)
   → included in WS snapshot        → dashboard AlertsPanel lights up (no refresh)
   → GET /api/alerts returns it     → bot alert_poller sees new id
                                     → posts "⚠️ Work Room 2 … it's 10 PM" to channel
```

Both surfaces show the _same_ alert from the _same_ backend computation. ✅ one source of truth.

### B. `!usage` command

```text
User: !usage  → bot → GET /api/summary (740W, 4.2 kWh)
             → llm.humanize(question, summaryJSON)
             → "Right now the office is pulling about 740W, and you've used ~4.2 kWh today. 💡"
```

### C. Live device flip

```text
tick loop flips work1-light-2 OFF → writes DB (last_changed updated)
   → snapshot broadcast → dashboard panel + office-layout light stops glowing instantly
   → next !status from bot reflects the same OFF state
```

---

## 15. Assumptions & Non-Goals

- **No real hardware.** Device data is simulated; the Wokwi schematic is a concept proof only.
- **No authentication.** Single-tenant internal tool; anyone with the URL can view. (Out of scope
  for the prelim.)
- **Fixed office.** Exactly 3 rooms × (2 fans + 3 lights + 1 controller) = 18 devices; layout matches the PDF and
  is not user-editable.
- **Power figures are nominal** (fan 60W, light 15W) — realistic, not metered.
- **`today_kwh`** is an estimate integrated from tick samples, reset at local midnight.

---

## 16. Traceability — every requirement has a home

| Problem-statement deliverable   | Where it's satisfied                                         |
| ------------------------------- | ------------------------------------------------------------ |
| High-level system diagram       | `docs/system-diagram.png` (§1 is the source)                 |
| Hardware/electrical schematic   | `hardware/wokwi/`                                            |
| Simulated dynamic device data   | `backend/app/simulator.py` + `devices`/`state_events` (§5–6) |
| Live device status panel        | `DeviceStatusPanel` via WS (§9)                              |
| Live power meter + per-room     | `PowerMeter` ← `/api/summary` (§7)                           |
| Active alerts panel             | `AlertsPanel` ← alerts engine (§8)                           |
| Discord bot commands            | `bot.py` (§10)                                               |
| LLM humanized responses         | `llm.py` (§11)                                               |
| Proactive alert posting (bonus) | `alert_poller` (§10)                                         |
| Animated office layout (bonus)  | `OfficeLayout` (§9)                                          |
| Shared single backend           | SQLite source of truth (§1–2)                                |
| No manual refresh               | WebSocket push (§7, §9)                                      |
| Public repo + README            | repo root + `docs/` (§4)                                     |
