# Techathon Prelim — Team Plan: "Lights, Fans, Discord"

## Context

We're building the boss's office-monitoring system: 18 simulated devices (2 fans + 3 lights + 1
controller × 3 rooms) whose live state flows through **one shared backend** to both a **real-time web
dashboard** and an **LLM-powered Discord bot**. No real hardware — data is simulated but must be
dynamic (change over time). Deliverables also include a system diagram, a Wokwi/Tinkercad circuit
schematic, a public repo with README, and a ≤3-min demo video.

The single hard architectural rule: **one source of truth**.
`[Simulated Device Layer] → [Backend API] → [Web UI] && [Discord Bot]`. Both interfaces read the
same live state — they must never disagree.

**Decided context:** ~1 week timeline · stack = **Python (FastAPI) backend + React frontend** ·
team of 4, evenly skilled · Sadi owns design + integration (circuit, system diagram, repo/README,
video) in addition to being the glue.

### Grade coverage (so we optimize for points)

| Deliverable                         | Weight | Owner                             |
| ----------------------------------- | ------ | --------------------------------- |
| Working web dashboard (real-time)   | 20%    | Arif                              |
| Discord bot (real simulated data)   | 10%    | Jifat                             |
| Dashboard visuals & UX              | 10%    | Arif                              |
| System diagram                      | 15%    | Sadi                              |
| Circuit schematic                   | 15%    | Sadi                              |
| Demo & dummy-data quality           | 15%    | Saima (data) + Sadi (video)       |
| Codebase structure, commits, README | 15%    | Sadi (+ everyone commits cleanly) |

---

## Team roles

- **Saima — Backend (the spine / source of truth).** Simulator engine, REST API, live push
  (WebSocket), alerts engine. _Critical path — unblocks everyone._
- **Arif — Frontend.** React dashboard: device panel, power meter, alerts panel, animated office
  layout. Consumes Saima's API + WebSocket.
- **Jifat — AI + Discord bot.** `discord.py` bot, LLM (Claude) for humanized replies, proactive
  alert posting. Consumes Saima's API.
- **Sadi — Circuit + Diagrams + Integration.** Wokwi ESP32 circuit, system diagram, repo scaffold,
  README, demo video, and keeping the shared API contract honest across the team.

---

## Day 0 (first hours, everyone together): lock the API contract

Nothing parallelizes until the contract is agreed. Sadi + Saima draft it; whole team signs off.
This lives in `README.md` / `docs/api-contract.md` so Arif and Jifat build against a stable shape.

**Device model (18 of these):**

```json
{
  "id": "work1-fan-1",
  "type": "fan", // "fan" | "light" | "controller"
  "label": "Fan 1",
  "room": "work1", // "drawing" | "work1" | "work2"
  "status": "on", // fans/lights: "on" | "off"; controllers: "online" | "offline"
  "power_w": 60, // fan/light watts when on; controllers report 0
  "last_changed": "2026-07-03T14:22:10Z"
}
```

**Endpoints (REST):**

- `GET /api/devices` → all 18 devices
- `GET /api/rooms/{room}` → devices + totals for one room
- `GET /api/summary` → `{ total_power_w, per_room: {...}, today_kwh, load_count_on, controllers_online }`
- `GET /api/alerts` → active alerts `[{ id, type, message, room, timestamp }]`
- (optional) `POST /api/devices/{id}/toggle` → lets the demo/video force interesting states

**Live push:** `WS /ws` — server broadcasts the full device+summary+alerts snapshot on every
simulator tick (e.g. every 2–3s) so the dashboard updates with **no page refresh**.

**Alert rules (defined once, in backend, shared by both UIs):**

- **After-hours:** any fan/light on outside 9 AM–5 PM.
- **Long-on room:** all 5 fans/lights in a room continuously on > 2 hours.
- **Controller offline:** a room controller is offline.
- Every alert is timestamped.

---

## Detailed tasks per person

### Saima — Backend (`/backend`, FastAPI)

1. **Simulator engine** — SQLite-backed store of 18 devices; a background task that flips random
   device states on an interval and updates `last_changed`. Keep it plausible (don't flip all 18
   every tick). Track a running `today_kwh` accumulator (power × elapsed time).
2. **REST endpoints** above, reading from the single SQLite source of truth.
3. **WebSocket broadcaster** — on each tick, push the snapshot to all connected clients.
4. **Alerts engine** — recompute after-hours + long-on-room alerts each tick; expose via
   `/api/alerts` and include in the WS snapshot. Add a way to simulate "it's 10 PM" for the demo
   (config override) so after-hours alerts are demonstrable on video.
5. Enable **CORS** for the React dev server. Provide a `requirements.txt` and a one-command run.

_Deliver a stub of `/api/devices` + `/ws` within the first day so Arif and Jifat can start._

### Arif — Frontend (`/frontend`, React + Vite)

1. **WebSocket client** — connect to `/ws`, keep a single live snapshot in state; fall back to
   polling `/api/summary` if WS drops.
2. **Live Device Status Panel** — 18 devices grouped by room, each labeled ("Fan 1", "Light 3")
   with a clear on/off indicator. Updates in real time.
3. **Live Power Consumption Meter** — total watts + per-room breakdown, updating live.
4. **Active Alerts Panel** — render `/alerts` items, timestamped, visually prominent.
5. **Office layout (BONUS, high UX value)** — top-view SVG matching the PDF's floor plan; lights
   **glow** when on, fans **spin (CSS animation)** when on. This is where the 10% UX points and
   bonus points live — prioritize after the 3 required panels work.
6. Keep it clean and usable; responsive is a plus.

### Jifat — AI + Discord bot (`/bot`, discord.py)

1. **Bot scaffold** — a bot in a test Discord server; reads live data by calling Saima's REST API
   (never its own copy of state).
2. **Commands** (names our choice — slash commands or `!` prefix):
   - `!status` → summary of all 3 rooms.
   - `!room <name>` → one room's status.
   - `!usage` → total power now + today's estimated kWh.
3. **LLM humanization (Claude, strongly encouraged & worth points)** — feed the _real_ fetched
   data into a Claude prompt to produce friendly, conversational replies (not raw data dumps, not
   hardcoded/random). Use `claude-haiku-4-5` for speed/cost; keep the API key in `.env`.
4. **Proactive alerts (BONUS)** — poll `/api/alerts` (or subscribe to WS); when a new alert
   appears, post to a designated channel, e.g. "⚠️ Work Room 2 still has 2 fans and 3 lights ON
   and it's 10 PM. Did someone forget to leave?"
5. Consult the Anthropic API docs for correct model IDs/params before writing the LLM calls.

### Sadi — Circuit + Diagrams + Integration (`/docs`, `/hardware`)

1. **Circuit schematic (Wokwi, ESP32)** — one representative room: ESP32 driving relay-switched
   stand-in loads for 2 fans + 3 lights connected to one controller, plus an analog current-sense
   concept (ACS712 stand-in) for power draw. Must make physical sense; label everything. Export
   image + share link into `/docs`. _Tip from the PDF: try both Wokwi and Tinkercad first — Wokwi
   tends to pair better with AI-assisted iteration._
2. **System diagram (NOT Mermaid)** — use Excalidraw / draw.io / Figma. Show the full flow:
   `devices → simulated data → backend → (WebSocket) → dashboard  &&  (REST) → Discord bot → user`.
   Export PNG/SVG into `/docs`.
3. **Repo scaffold & README** — set up `/backend /frontend /bot /docs /hardware`, write the README
   with per-component setup/run steps, architecture overview, and embed both diagrams.
4. **Integration & demo** — mid-week, verify all three components read consistent data; record the
   ≤3-min video (dashboard live-updating, bot answering, one alert firing) and narrate the data
   flow.

---

## Week milestones

- **Day 1:** API contract locked. Saima ships stubbed `/api/devices` + `/ws`. Sadi scaffolds repo.
  Arif + Jifat scaffold their apps against the contract.
- **Day 2–3:** Saima finishes simulator + alerts. Arif lands the 3 required panels (live). Jifat
  lands the 3 commands with real data.
- **Day 4:** LLM humanization + proactive alerts. Arif starts the animated office layout.
- **Day 5:** Sadi finishes circuit + system diagram. Integration pass — confirm dashboard and bot
  never disagree.
- **Day 6:** Polish (UX, README), record demo video.
- **Day 7:** Buffer — dry-run the full demo, tidy commits.

**Commit hygiene (15% includes commits):** each member commits to their own area with clear
messages; small frequent commits > one giant dump. Consider a short-lived branch per component.

---

## Verification (how we prove it works end-to-end)

1. **Single source of truth:** call `!status` in Discord and read the dashboard at the same
   moment — they must show identical device states. Toggle a device (or wait a tick) and confirm
   _both_ reflect the change.
2. **No-refresh live update:** watch the dashboard change state without reloading the page (WS).
3. **Power math:** `/api/summary` total = sum of `power_w` of all `on` devices; per-room adds up.
4. **Alerts:** flip the backend's "current time" override to 10 PM with devices on → an alert
   appears in the dashboard panel _and_ the bot proactively posts it.
5. **Circuit sanity:** the Wokwi sim runs; toggling an input visibly changes a device output.
6. **Docs:** a fresh clone + README steps brings up backend, frontend, and bot.

---

## Verdict on the original division

Keep Arif→frontend, Saima→backend, Jifat→AI+Discord. The one change: **expand Sadi from
circuit-only to circuit + system diagram + repo/README + integration/video**, because circuit
alone under-uses one person while 30%+ of the grade (diagram, README/commits, demo) otherwise has
no clear owner. Also treat the **backend API contract as a Day-1 whole-team deliverable**, since
it blocks both the dashboard and the bot.
