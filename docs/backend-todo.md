# Backend Work Plan — Saima's Remaining Tasks

> Generated from a gap analysis of `/backend` against `docs/architecture.md`, `docs/api-contract.md`,
> and `docs/TEAM_PLAN.md` (2026-07-03). The scaffold already matches the contract shape closely —
> these are the remaining functional gaps, in priority order. Each task has a ready-to-use prompt
> you can paste into Claude Code (or follow yourself) to implement it.
>
> Ordering below is re-anchored to the official evaluation criteria (`Hackathon Problem Statement
> (Preliminary Round).pdf`, evaluation table) rather than pure engineering tidiness — see
> "Evaluation criteria mapping" for why each task is prioritized where it is.

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
| SQLite schema + seed (18 devices) | Done |
| REST endpoints (`/api/devices`, `/rooms`, `/summary`, `/history`, `/alerts`, toggle/state, demo) | Done |
| WebSocket `/ws` snapshot on connect + broadcast on tick/change | Done |
| Error envelope (`not_found`, `validation_error`) | Done |
| Alerts engine — `after_hours`, `controller_offline` | Done |
| **Simulator auto-flip (dynamic data)** | **Missing — highest grading leverage (20% + 15%)** |
| **`today_kwh` calculation** | **Missing (hardcoded 0.0) — blocks dashboard + bot (20% + 10%)** |
| **`long_on` alert 2-hour duration check** | **Missing (fires immediately) — dashboard alerts panel (20%)** |
| Randomized initial seed state | Missing (all start off/online) — cosmetic demo polish |
| Acceptance checklist re-verification | Not yet run |

---

## Task 1 — Make the simulator actually flip devices (highest priority)

**Why:** `backend/app/simulator.py` `_loop()` currently only builds a snapshot and appends a
history row every tick — it never changes a device's status. The grading criteria require
"simulated dynamic device data" that changes over time on its own, not just via manual toggle.
This blocks the history chart, the alerts engine, and the bot demo from ever showing organic change.

**Grading impact:** Highest leverage item on the whole list — it's the difference between "Quality
of demo & dummy-data simulation" (15%) reading as real vs. staged, and it's a prerequisite for the
"real-time" half of the dashboard criterion (20%) actually being visible on camera.

**Files:** `backend/app/simulator.py`, `backend/app/db.py`

**Prompt:**
```
In backend/app/simulator.py, add a maybe_flip_devices() function that runs once per tick before
build_snapshot(). It should:
- Fetch all devices via get_devices() (or a new db.py helper).
- Randomly pick 1-3 devices to flip this tick (don't flip all 18 every tick).
- Weight the probability of flipping toward ON during Asia/Dhaka office hours (09:00-17:00) and
  toward OFF outside those hours, using clock.utc_now() converted to BUSINESS_TZ — reuse the same
  office-hours logic pattern as alerts.py's _is_after_hours().
- For fans/lights, flip status between "on"/"off". Leave controllers mostly stable (rare/no offline
  flips, or a very low-probability offline flip so controller_offline alerts are demonstrable).
- Call db.set_device_status(device_id, new_status) for each flipped device, which already updates
  last_changed.
- Wire maybe_flip_devices() into simulator.py's _loop() before snapshot = build_snapshot().
Keep it deterministic-testable where reasonable (inject a random.Random instance rather than using
the global random module directly, so tests can seed it).
```

---

## Task 2 — Compute `today_kwh` from history samples

**Why:** `backend/app/power.py` `build_summary()` hardcodes `"today_kwh": 0.0`. The contract
requires it to be "an estimate integrated from simulator samples since local midnight in
Asia/Dhaka" (api-contract.md §3, `Summary` rules).

**Grading impact:** Feeds two graded surfaces directly — the dashboard's Live Power Consumption
Meter (part of the 20% dashboard criterion) and the bot's `!usage` command, whose spec example is
literally `"Today's estimated usage: 4.2 kWh"` (10% bot criterion). Both currently show 0 all demo.

**Files:** `backend/app/power.py`, `backend/app/db.py`

**Prompt:**
```
Add a function in db.py, e.g. get_today_kwh(), that:
- Computes local midnight in Asia/Dhaka for "now" (use clock.BUSINESS_TZ), converts it to UTC.
- Selects state_events rows with ts >= that UTC midnight, ordered by ts.
- Integrates power over time: for consecutive samples, multiply the wattage by the elapsed seconds
  between them (or between the sample and clock.utc_now() for the trailing edge), sum in watt-seconds,
  convert to kWh (watt-seconds / 3600 / 1000).
- Returns 0.0 if there are no samples yet today.
Call this from power.build_summary() instead of the hardcoded 0.0. Keep power.py's existing pure-
function style — pass today's kwh in as a parameter if you want to avoid power.py importing db.py
directly (check how snapshot.py wires build_summary() today and match that pattern).
```

---

## Task 3 — Fix the `long_on` alert to require a 2-hour duration

**Why:** `backend/app/alerts.py` (around line 41) fires `long_on` as soon as all 5 fans/lights in a
room are simultaneously ON — it never checks how long they've been on. The contract requires
"continuously on for more than two hours" (api-contract.md, Alert rules), tracked from the oldest
`last_changed` among the room's loads.

**Grading impact:** The Active Alerts Panel is an explicitly graded dashboard feature (20%
criterion). An alert that fires instantly (or never sustains long enough once Task 1's auto-flip
is in place) reads as broken on camera during the demo.

**Files:** `backend/app/alerts.py`

**Prompt:**
```
In alerts.py's build_alerts(), the long_on block currently only checks
`len(loads) == 5 and len(on_loads) == 5`. Add a duration check: compute
`since = min(device["last_changed"] for device in on_loads)`, parse it to a datetime, and only emit
the alert if `utc_now() - since > timedelta(hours=2)`. Reuse the existing `since` value you already
compute for the message/alert dict instead of recomputing it. Keep the alert `id` format
(`long_on-{room}-{hour-bucket}`) unchanged so dedup still works.
```

---

## Task 4 — Randomize initial seed state

**Why:** `backend/app/db.py` `seed_devices()` always seeds every fan/light as `off` and every
controller as `online`. architecture.md §5 calls for randomized initial state "so the dashboard has
something live immediately" on first load/demo.

**Grading impact:** Cosmetic polish for "Quality of demo & dummy-data simulation" (15%) — makes the
first few seconds of the demo look alive before the first tick lands. Lower priority than Tasks 1–3
since it doesn't unblock any other graded feature.

**Files:** `backend/app/db.py`

**Prompt:**
```
In db.py's seed_devices(), instead of always setting status = "online" for controllers and "off" for
fans/lights, randomly choose the initial status per device (e.g. random.choice(["on", "off"]) for
fans/lights, weighted mostly "online" for controllers since offline should be rare). Keep this
seeding logic isolated to first-run (empty DB) only — don't re-randomize on every restart once data
exists.
```

---

## Task 5 — Re-verify against the acceptance checklist

**Why:** Once Tasks 1-4 land, re-run the full checklist in `docs/api-contract.md` §8 to confirm
nothing regressed.

**Prompt:**
```
Start the backend (uv run python main.py) and manually verify every item in api-contract.md's
"Acceptance Checklist" section: 18 valid devices, 2 fans/3 lights/1 controller per room,
total_power_w equals sum of on fan/light power_w, load_count_on and controllers_online counts are
correct, POST /api/demo/clock forces an after-hours alert, POST /api/demo/simulator pauses random
flips, WS sends a snapshot immediately on connect, and invalid room/device IDs return the documented
error envelope. Also confirm devices now visibly change state on their own every few ticks without
any manual toggle call.
```

---

## Task 6 — Minor cleanup

**Why:** Small correctness/lint nit, not contract-blocking.

**Prompt:**
```
In backend/app/routers/devices.py, CONTROLLER_TYPE is imported but never used — remove the unused
import (or use it if you add controller-specific logic later).
```

---

## Suggested order

Do Task 1 first (it unblocks realistic history/alerts/demo data), then 3 (alert correctness depends
on real flip history), then 2, then 4, then verify with 5, and clean up with 6. This order maps to
descending grading leverage per "Evaluation criteria mapping" above, not just dependency order —
Tasks 1–3 alone cover the dashboard (20%), demo-quality (15%), and bot (10%) criteria; Tasks 4–6 are
polish and codebase-hygiene (15%) that matter but don't unblock anything else.

Each task is a natural unit for one scoped commit (per TEAM_PLAN.md's "small frequent commits"
rule, which factors into the 15% codebase/commits criterion) — commit after each task passes its
own manual check rather than batching all four into one drop.
