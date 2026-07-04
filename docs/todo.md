# Team Todo - Lights, Fans, Discord

This is the execution checklist for the preliminary-round build. The fixed source of truth for
API shapes is [`docs/api-contract.md`](./api-contract.md).

## Project-Wide Rules

- [ ] Build every component against `docs/api-contract.md`.
- [ ] Keep the backend as the only writer of device state.
- [ ] Keep SQLite as the backend source of truth.
- [ ] Use the fixed device model: 3 rooms, each with 2 fans, 3 lights, and 1 controller.
- [ ] Use `on` / `off` only for fans and lights.
- [ ] Use `online` / `offline` only for controllers.
- [ ] Keep power math and alert logic in the backend only.
- [ ] Make the dashboard and Discord bot display backend values instead of recomputing them.
- [ ] Use `load_count_on`, `loads_on`, and `controllers_online` from the contract; do not use stale `device_count_on` / `devices_on` fields.
- [ ] Keep commits small and scoped to each person’s component.

## Day 0 Coordination

- [ ] Everyone reads `docs/api-contract.md`.
- [ ] Everyone confirms the device model: 18 devices total, 6 fans, 9 lights, 3 controllers.
- [ ] Saima confirms which backend endpoints are already available and which are still scaffold-only.
- [ ] Arif confirms frontend env values: `VITE_API_BASE=http://localhost:8000` and `VITE_WS_URL=ws://localhost:8000/ws`.
- [ ] Jifat confirms bot env values needed: `DISCORD_TOKEN`, `ALERT_CHANNEL_ID`, `API_BASE`, `ANTHROPIC_API_KEY`.
- [ ] Sadi confirms the demo flow: dashboard live state, bot command response, one alert firing.

## Saima - Backend

### Contract and Data Model

- [ ] Keep `backend/app/schemas.py` aligned with `docs/api-contract.md`.
- [ ] Ensure SQLite seeds exactly 18 devices.
- [ ] Ensure each room seeds `fan-1`, `fan-2`, `light-1`, `light-2`, `light-3`, `controller-1`.
- [ ] Ensure fans have `power_rated_w = 60`.
- [ ] Ensure lights have `power_rated_w = 15`.
- [ ] Ensure controllers have `power_rated_w = 0`.
- [ ] Ensure controllers always return `power_w = 0`.
- [ ] Ensure invalid rooms and device IDs return the documented error envelope.

### REST API

- [ ] Finish `GET /health`.
- [ ] Finish `GET /api/devices`.
- [ ] Finish `GET /api/devices/{device_id}`.
- [ ] Finish `GET /api/rooms/{room}`.
- [ ] Finish `GET /api/summary`.
- [ ] Finish `GET /api/history?minutes=30`.
- [ ] Finish `GET /api/alerts`.
- [ ] Finish `POST /api/devices/{device_id}/toggle`.
- [ ] Finish `POST /api/devices/{device_id}/state`.
- [ ] Finish `POST /api/demo/clock`.
- [ ] Finish `POST /api/demo/simulator`.
- [ ] Finish `GET /api/demo/state`.

### Simulator and Power

- [ ] Implement realistic fan/light state changes on the background tick.
- [ ] Avoid flipping all devices at once.
- [ ] Keep controller online/offline changes rare and demo-friendly.
- [ ] Append `state_events` rows on each simulator tick.
- [ ] Compute `total_power_w` from fans and lights only.
- [ ] Compute per-room `power_w`, `loads_on`, and `controllers_online`.
- [ ] Implement `today_kwh` from tick samples since local midnight in `Asia/Dhaka`.
- [ ] Ensure manual device changes trigger a fresh WebSocket snapshot.
- [ ] Ensure simulator pause stops random changes but manual controls and reads still work.

### Alerts

- [ ] Implement `after_hours` for any fan/light on outside 09:00-17:00 in `Asia/Dhaka`.
- [ ] Implement `long_on` for all five fans/lights in a room continuously on for more than 2 hours.
- [ ] Implement `controller_offline` when a room controller is offline.
- [ ] Make alert IDs stable enough for bot deduplication.
- [ ] Remove alerts from `GET /api/alerts` as soon as their condition clears.
- [ ] Include alerts in every WebSocket snapshot.

### Backend Validation

- [ ] Run `python3 -m compileall .` inside `backend`.
- [ ] Run a smoke check that `GET /api/devices` returns 18 devices.
- [ ] Verify type counts: 6 fans, 9 lights, 3 controllers.
- [ ] Verify every room returns exactly 6 devices.
- [ ] Verify `/api/summary.total_power_w` equals the sum of fan/light `power_w`.
- [ ] Verify demo clock can force an after-hours alert.
- [ ] Verify `POST /api/demo/simulator` pauses and resumes simulator changes.

## Arif - Frontend

### API Integration

- [ ] Create frontend TypeScript types from `docs/api-contract.md`.
- [ ] Add a REST client for `/api/devices`, `/api/summary`, `/api/alerts`, and `/api/history`.
- [ ] Add a WebSocket client for `WS /ws`.
- [ ] Build a `useLiveData` hook around the latest WebSocket `snapshot`.
- [ ] Send all dashboard components data from the single latest snapshot.
- [ ] Add REST polling fallback if WebSocket disconnects.
- [ ] Show a disconnected/reconnecting state when WebSocket is unavailable.

### Required Dashboard Panels

- [ ] Build the live device status panel grouped by Drawing Room, Work Room 1, and Work Room 2.
- [ ] Show all 18 devices.
- [ ] Display fans and lights as `on` / `off`.
- [ ] Display controllers as `online` / `offline`.
- [ ] Build the live power meter from `summary.total_power_w`.
- [ ] Show per-room `power_w`, `loads_on`, and `controllers_online`.
- [ ] Build the active alerts panel from backend alerts.
- [ ] Show alert type, room, message, and timestamp.

### Office Layout and UX

- [ ] Build the top-view office layout after the required panels work.
- [ ] Map each fan/light/controller to its backend device ID.
- [ ] Animate fans when `status === "on"`.
- [ ] Make lights glow when `status === "on"`.
- [ ] Show controller connection state clearly.
- [ ] Keep the dashboard usable on laptop and mobile widths.
- [ ] Avoid computing alert or power truth in React.

### Frontend Validation

- [ ] Run `npm run build`.
- [ ] Run `npm run lint`.
- [ ] Confirm dashboard renders correctly with the canonical fixture shape.
- [ ] Confirm dashboard updates after `POST /api/devices/{device_id}/toggle`.
- [ ] Confirm alerts appear after Saima triggers demo clock.
- [ ] Confirm WebSocket reconnect/fallback behavior is visible.

## Jifat - Discord Bot

### Bot Scaffold

- [ ] Create `/bot` folder.
- [ ] Add `discord.py`, `httpx`, Anthropic SDK, and env loading.
- [ ] Add `bot/.env.example` with `DISCORD_TOKEN`, `ALERT_CHANNEL_ID`, `API_BASE`, and `ANTHROPIC_API_KEY`.
- [ ] Add `bot/README.md` with setup and run commands.
- [ ] Keep secrets out of git.

### Backend Client

- [ ] Build `backend_client.py` against `docs/api-contract.md`.
- [ ] Implement `get_devices()`.
- [ ] Implement `get_room(room)`.
- [ ] Implement `get_summary()`.
- [ ] Implement `get_alerts()`.
- [ ] Handle non-2xx contract error envelopes.
- [ ] Add local mock payloads copied from `docs/api-contract.md` so work can start before backend is fully ready.

### Commands

- [ ] Implement `!status` for all rooms.
- [ ] Implement `!room <name>` for `drawing`, `work1`, and `work2`.
- [ ] Implement aliases for user-friendly room names if time allows, such as `work room 1`.
- [ ] Implement `!usage` using `GET /api/summary`.
- [ ] Ensure replies use real backend JSON values only.
- [ ] Mention controller state when useful, especially if a controller is offline.
- [ ] Keep a plain template fallback for every command.

### LLM Humanization

- [ ] Add `llm.py` for Claude response humanization.
- [ ] Use the provided backend JSON as the only factual context.
- [ ] Instruct the LLM not to invent rooms, devices, power, or alerts.
- [ ] Fall back to template output if the LLM call fails or times out.
- [ ] Keep responses concise enough for Discord.

### Proactive Alerts

- [ ] Poll `GET /api/alerts` every 15 seconds.
- [ ] Deduplicate by `alert.id`.
- [ ] Post new alerts to `ALERT_CHANNEL_ID`.
- [ ] Include room, alert message, and timestamp in proactive posts.
- [ ] Confirm `after_hours`, `long_on`, and `controller_offline` alerts all produce useful messages.

### Bot Validation

- [ ] Test commands against mock payloads.
- [ ] Test commands against Saima’s live backend.
- [ ] Confirm `!status` and dashboard show the same state at the same time.
- [ ] Confirm `!usage` matches `GET /api/summary`.
- [ ] Confirm proactive alerts do not spam repeated alert IDs.

## Sadi - Docs, Hardware, Integration, Demo

### Contract and Docs

- [ ] Keep `docs/api-contract.md` as the fixed source of truth.
- [ ] Keep `README.md`, `backend/README.md`, and `frontend/README.md` aligned with implementation.
- [ ] Keep `docs/architecture.md` aligned with the actual repo shape.
- [ ] Keep this todo file updated as ownership or scope changes.
- [ ] Add missing bot and hardware setup docs when those folders exist.

### System Diagram

- [ ] Create a non-Mermaid system diagram in Excalidraw, draw.io, Figma, or similar.
- [ ] Show room devices/controllers feeding simulated backend data.
- [ ] Show FastAPI + SQLite as the source of truth.
- [ ] Show WebSocket path to the React dashboard.
- [ ] Show REST path to the Discord bot.
- [ ] Export the diagram image into `docs/`.
- [ ] Link the diagram from the root README after export.

### Hardware Schematic

- [x] Create one representative-room schematic in Wokwi or Tinkercad.
- [x] Include one ESP32/Arduino controller.
- [x] Include 2 fan stand-ins.
- [x] Include 3 light stand-ins.
- [x] Use buttons/switches as device state inputs.
- [x] Use LEDs/relay modules as output stand-ins where appropriate.
- [x] Add optional current-sense concept if time permits.
- [x] Document pin mapping and connection reasoning.
- [x] Export screenshot/share link into `docs/` or `hardware/`.

### Integration

- [ ] Run backend locally.
- [ ] Run frontend locally.
- [ ] Run bot locally once Jifat has scaffolded it.
- [ ] Confirm dashboard and bot read the same backend state.
- [ ] Toggle a device and confirm both dashboard and bot reflect it.
- [ ] Force 10 PM with demo clock and confirm alert appears in dashboard.
- [ ] Confirm bot posts the same alert proactively.
- [ ] Confirm controller offline alert is visible in dashboard and bot.

### Demo Video

- [ ] Write a short demo script under 3 minutes.
- [ ] Show live dashboard updating without refresh.
- [ ] Show `!status`.
- [ ] Show `!room work2`.
- [ ] Show `!usage`.
- [ ] Show after-hours alert firing.
- [ ] Explain the architecture: simulated devices/controllers -> SQLite backend -> dashboard and bot.
- [ ] Mention single source of truth explicitly.
- [ ] Record final video after one full dry run.

## Cross-Team Checkpoints

- [ ] Day 0: API contract accepted by all four members.
- [ ] Day 1: Saima exposes `/api/devices`, `/api/summary`, and `/ws`.
- [ ] Day 1: Arif can render from mock payloads or live backend payloads.
- [ ] Day 1: Jifat can run bot commands against mock payloads.
- [ ] Day 2: frontend panels show live backend data.
- [ ] Day 2: bot commands read live backend data.
- [ ] Day 3: alert rules work in backend.
- [ ] Day 4: proactive bot alerts work.
- [ ] Day 5: system diagram and circuit schematic are ready.
- [ ] Day 6: README, docs, and demo script are polished.
- [ ] Day 7: dry run only, then final submission.

## Final Acceptance Checklist

- [ ] Public repo is clean and documented.
- [ ] Fresh clone can run backend from README steps.
- [ ] Fresh clone can run frontend from README steps.
- [ ] Bot setup is documented once `/bot` exists.
- [ ] `GET /api/devices` returns 18 devices.
- [ ] Dashboard shows all 18 devices.
- [ ] Dashboard updates without manual refresh.
- [ ] Bot answers from real backend data.
- [ ] Bot and dashboard never disagree when checked at the same moment.
- [ ] Alerts are timestamped.
- [ ] Demo controls can reliably trigger an alert.
- [ ] System diagram is included in the repo.
- [x] Circuit schematic is included in the repo.
- [ ] Final demo video is 3 minutes or less.
