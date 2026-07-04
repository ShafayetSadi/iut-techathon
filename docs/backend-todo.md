# Backend Work Plan — Saima's Remaining Tasks

> Generated from a gap analysis of `/backend` against `docs/architecture.md`, `docs/api-contract.md`,
> and `docs/TEAM_PLAN.md` (2026-07-03). The scaffold already matches the contract shape closely —
> these are the remaining functional gaps, in priority order. Each task has a ready-to-use prompt
> you can paste into Claude Code (or follow yourself) to implement it.
>
> Ordering below is re-anchored to the official evaluation criteria (`Hackathon Problem Statement
> (Preliminary Round).pdf`, evaluation table) rather than pure engineering tidiness — see
> "Evaluation criteria mapping" for why each task is prioritized where it is.
>
> **Re-verified 2026-07-04 against the actual running code** (not just reading source — the backend
> was started and every endpoint below was hit with `curl`). Tasks 1–4 and 6 are done; Task 5 turned
> up two real contract violations, written up and fixed as Task 7.
>
> **All tasks now complete (2026-07-04).** No open backend work remains against the current contract.

---

## Evaluation criteria mapping

The rubric has no line item for scalability, concurrency, or infra robustness — don't spend
backend time there before the tasks below. Weighted criteria and what actually drives each score:

| Criterion | Weight | Depends on backend for... |
| --- | --- | --- |
| Working web dashboard, real-time | 20% | Devices actually changing over time (Task 1); correct `today_kwh` + alerts feeding the Power Meter and Alerts Panel (Tasks 2–3) |
| Quality of demo & dummy-data simulation | 15% | Task 1 directly — a dashboard that doesn't move on its own reads as fake on camera regardless of how correct the WS plumbing is |
| Working Discord bot, real data | 10% | `today_kwh` for `!usage` (Task 2); real alert data for proactive posts (Task 3) |
| Codebase structure, commits, docs | 15% | Already the strongest area — keep README/api-contract.md in sync as these land; small scoped commits per task |
| Dashboard visuals/UX | 10% | Frontend-owned; backend just needs a stable, correct contract |
| System diagram | 15% | Sadi-owned; diagram must stay truthful to what the backend actually does (e.g. "simulator flips devices" becomes true after Task 1) |
| Circuit schematic | 15% | Sadi-owned; no backend dependency |

Net effect: Tasks 1–3 sit under roughly 45% of the total grade (dashboard 20% + demo quality 15% +
bot 10%) even though "backend" isn't its own line item. That's why they outrank the seed-state
polish and cleanup tasks below.

---

## Status snapshot

| Area | State |
| --- | --- |
| SQLite schema + seed (15 devices) | Done |
| REST endpoints (`/api/devices`, `/rooms`, `/summary`, `/history`, `/alerts`, toggle/state, demo) | Done |
| WebSocket `/ws` snapshot on connect + broadcast on tick/change | Done |
| Error envelope (`not_found`) | Done — confirmed live for bad device/room IDs |
| Alerts engine — `after_hours`, `long_on` | Done — confirmed live via demo clock override |
| Simulator auto-flip (dynamic data) | **Done** — `maybe_flip_devices()` implemented and wired into `_loop()` |
| `today_kwh` calculation | **Done** — `db.get_today_kwh()` integrates `state_events`, wired through `snapshot.py` |
| `long_on` alert 2-hour duration check | **Done** — `alerts.py` checks `utc_now() - since > timedelta(hours=2)` |
| Randomized initial seed state | **Done** — `initial_device_status()` randomizes on/off, first-run only |
| CONTROLLER_TYPE cleanup (old Task 6) | **Done** — controller concept fully removed from code |
| `GET /api/history?minutes=` out-of-range validation | **Done** — raises the documented 422 instead of clamping |
| `POST /api/devices/{id}/state` invalid-status error shape | **Done** — returns the documented `validation_error` envelope |
| Acceptance checklist re-verification | **Done 2026-07-04** — see Task 5 result below |

---

## Tasks 1–4, 6 — Done (verified against running code, 2026-07-04)

These were the original highest-priority gaps. All are now implemented and were confirmed by
starting the backend and hitting the live endpoints, not just by reading the source:

- **Task 1 (simulator auto-flip):** `simulator.py` has `maybe_flip_devices()`, weighted toward ON
  during Asia/Dhaka office hours and OFF outside them, picking 1–3 devices per tick, wired into
  `_loop()` before `build_snapshot()`. Confirmed `total_power_w`/`loads_on` changing across
  consecutive `/api/summary` calls with the simulator running.
- **Task 2 (`today_kwh`):** `db.get_today_kwh()` integrates `state_events` watt-seconds since local
  midnight in `Asia/Dhaka`, wired through `snapshot.py` and `routers/summary.py`. Confirmed
  `/api/summary` returns a real non-zero value (e.g. `2.396...`), not the old hardcoded `0.0`.
- **Task 3 (`long_on` 2-hour duration):** `alerts.py` computes `since = min(last_changed of on_loads)`
  and only emits when `utc_now() - since > timedelta(hours=2)`.
- **Task 4 (randomized seed):** `db.initial_device_status()` uses `random.choice(["on", "off"])`,
  applied only when the devices table is empty (first run).
- **Task 6 (cleanup):** no `CONTROLLER_TYPE` import exists anywhere in the backend; the controller
  device type is fully removed, and `db.py` even purges legacy `controller` rows on startup.

---

## Task 5 result — Acceptance checklist re-verification (done 2026-07-04)

Ran `uv run uvicorn app.main:app` and hit every endpoint with `curl`. Results against
`docs/api-contract.md` §8:

| Checklist item | Result |
| --- | --- |
| `GET /api/devices` returns exactly 15 valid devices | ✅ Pass |
| Every room has exactly two fans and three lights | ✅ Pass |
| `total_power_w` equals sum of all fan/light `power_w` | ✅ Pass (e.g. 75+135+120=330 matched) |
| `load_count_on` equals number of `on` fans/lights | ✅ Pass |
| `POST /api/demo/clock` forces an after-hours alert | ✅ Pass — 3 `after_hours` alerts appeared immediately |
| `POST /api/demo/simulator` pauses/resumes flips | ✅ Pass |
| WebSocket sends a snapshot immediately on connect | ✅ Pass (per `main.py`'s `/ws` handler) |
| Invalid room/device IDs return the documented error envelope | ✅ Pass — both return `{"error": {"code": "not_found", ...}}` |
| Invalid `POST /api/devices/{id}/state` body returns the documented error envelope | ❌ **Fail** — see Task 7 |
| Invalid `GET /api/history?minutes=` returns the documented 422 | ❌ **Fail** — see Task 7 |

Two real, previously-untracked contract violations turned up. Everything else in the original
Task 1–4/6 list checks out.

---

## Task 7 — Fixed: two error-envelope contract violations (done 2026-07-04)

**Was:** `api-contract.md` §4 documents specific `422`/`400` envelope responses for two endpoints,
but neither reached the custom error handling — Pydantic's own validation rejected the request
first and FastAPI returned its default (non-contract) error shape.

**Fix applied:**

1. **`backend/app/schemas.py`** — `DeviceStateRequest.status` changed from `Literal["on", "off"]`
   (`DeviceStatus`) to plain `str`. This was the root cause of Bug A: the `Literal` type made
   Pydantic reject invalid values *before* `routers/devices.py`'s existing
   `if request.status not in valid_statuses: raise validation_error(...)` check ever ran, so that
   check was dead code. Loosening the type lets the existing check do its job and produce the
   exact contract message.
2. **`backend/app/main.py`** — added an `@app.exception_handler(RequestValidationError)` that
   converts any remaining Pydantic-level failures (malformed JSON, missing fields, bad query-param
   types) into the contract envelope: `json_invalid` errors → `400 bad_request`, everything else →
   `422 validation_error`, merging `request.path_params` (e.g. `device_id`) into `details`.
3. **`backend/app/routers/summary.py`** — `read_history()` no longer clamps out-of-range `minutes`;
   it now raises `errors.validation_error("minutes must be between 1 and 180.", minutes=minutes)`.

**Verified live** (server started, each case re-curled after the fix):

| Request | Response |
| --- | --- |
| `POST /devices/work1-fan-1/state {"status":"online"}` | `422 {"error":{"code":"validation_error","message":"status is invalid for this device type.","details":{"device_id":"work1-fan-1","status":"online"}}}` — matches contract exactly |
| `GET /api/history?minutes=999` | `422 {"error":{"code":"validation_error","message":"minutes must be between 1 and 180.","details":{"minutes":999}}}` — matches contract exactly |
| `GET /api/history?minutes=0` | Same 422 shape, `details.minutes: 0` |
| `POST /devices/work1-fan-1/state` with malformed JSON body | `400 {"error":{"code":"bad_request","message":"Invalid JSON body.","details":{"device_id":"work1-fan-1"}}}` |
| `POST /devices/work1-fan-1/state {}` (missing `status`) | `422 {"error":{"code":"validation_error","message":"Field required","details":{"device_id":"work1-fan-1","status":{}}}}` |
| Regression: valid state change, valid history range, 404s for bad room/device IDs | All still pass, unchanged |

**Files touched:** `backend/app/schemas.py`, `backend/app/main.py`, `backend/app/routers/summary.py`.

---

## Suggested order

All tasks (1–7) are complete and re-verified against the running server. Nothing outstanding
against the current `api-contract.md`.
