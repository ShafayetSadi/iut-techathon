# API Contract - Lights, Fans, Discord

This file is the fixed contract for backend, frontend, and Discord bot work.
Saima may change backend internals, but the public JSON shapes, paths, enum values, and error
format below must stay stable unless the team lead explicitly updates this document.

## 1. Contract Rules

- Backend: FastAPI.
- Source of truth: SQLite database behind the backend.
- Base URL in development: `http://localhost:8000`.
- Response format: JSON.
- Authentication: none for the preliminary round.
- Wire timestamps: ISO 8601 UTC strings, for example `2026-07-03T16:00:00Z`.
- Alert business timezone: `Asia/Dhaka`.
- Office hours: `09:00` through `17:00` in `Asia/Dhaka`.
- Simulator tick target: every `3` seconds.
- WebSocket path: `ws://localhost:8000/ws` in development.

Only the backend computes power totals, `today_kwh`, alert rules, and current device state.
The dashboard and bot are readers.

## 2. Fixed Domain Values

### Rooms

| Value | Display name |
| --- | --- |
| `drawing` | `Drawing Room` |
| `work1` | `Work Room 1` |
| `work2` | `Work Room 2` |

### Device Types

| Value | Rated power | Status values | Notes |
| --- | ---: | --- | --- |
| `fan` | `60` watts | `on`, `off` | Electrical load. |
| `light` | `15` watts | `on`, `off` | Electrical load. |
| `controller` | `0` watts | `online`, `offline` | One ESP32/Arduino per room. It monitors/controls that room. |

### Device IDs

Device IDs are deterministic:

```text
{room}-{type}-{number}
```

Examples:

- `drawing-fan-1`
- `work1-light-2`
- `work2-controller-1`

Each room has exactly six devices:

- `fan-1`
- `fan-2`
- `light-1`
- `light-2`
- `light-3`
- `controller-1`

The full system has exactly 18 devices:

- 6 fans total.
- 9 lights total.
- 3 controllers total.

## 3. Shared Schemas

### `Device`

Fan/light example:

```json
{
  "id": "work1-fan-1",
  "type": "fan",
  "label": "Fan 1",
  "room": "work1",
  "status": "on",
  "power_w": 60,
  "power_rated_w": 60,
  "last_changed": "2026-07-03T15:50:00Z"
}
```

Controller example:

```json
{
  "id": "work1-controller-1",
  "type": "controller",
  "label": "Controller 1",
  "room": "work1",
  "status": "online",
  "power_w": 0,
  "power_rated_w": 0,
  "last_changed": "2026-07-03T15:00:00Z"
}
```

Fields:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Stable device ID. |
| `type` | string | `fan`, `light`, or `controller`. |
| `label` | string | Human label, for example `Fan 1` or `Controller 1`. |
| `room` | string | `drawing`, `work1`, or `work2`. |
| `status` | string | Fans/lights use `on`/`off`; controllers use `online`/`offline`. |
| `power_w` | number | Current draw. Fans/lights are `0` when off; controllers are always `0`. |
| `power_rated_w` | number | Fan is `60`, light is `15`, controller is `0`. |
| `last_changed` | string | ISO UTC timestamp from the last status change. |

### `RoomSummary`

```json
{
  "room": "work1",
  "display_name": "Work Room 1",
  "power_w": 135,
  "loads_on": 3,
  "controllers_online": 1,
  "device_count": 6
}
```

### `Summary`

```json
{
  "total_power_w": 375,
  "per_room": {
    "drawing": {
      "room": "drawing",
      "display_name": "Drawing Room",
      "power_w": 75,
      "loads_on": 2,
      "controllers_online": 1,
      "device_count": 6
    },
    "work1": {
      "room": "work1",
      "display_name": "Work Room 1",
      "power_w": 135,
      "loads_on": 3,
      "controllers_online": 1,
      "device_count": 6
    },
    "work2": {
      "room": "work2",
      "display_name": "Work Room 2",
      "power_w": 165,
      "loads_on": 5,
      "controllers_online": 1,
      "device_count": 6
    }
  },
  "today_kwh": 4.2,
  "load_count_on": 10,
  "controllers_online": 3,
  "device_count": 18,
  "server_time": "2026-07-03T16:00:00Z"
}
```

Rules:

- `total_power_w` must equal the sum of current `power_w` for fans and lights.
- Controllers do not add to `total_power_w` or `today_kwh`.
- `load_count_on` counts only fans/lights whose `status` is `on`.
- `controllers_online` counts controllers whose `status` is `online`.
- `today_kwh` is an estimate integrated from simulator samples since local midnight in
  `Asia/Dhaka`.

### `Alert`

```json
{
  "id": "after_hours-work2-2026-07-03T16",
  "type": "after_hours",
  "room": "work2",
  "message": "Work Room 2 has 2 fans and 3 lights ON after office hours.",
  "since": "2026-07-03T16:00:00Z",
  "timestamp": "2026-07-03T16:00:03Z"
}
```

Fields:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Stable ID for deduplication while the condition remains active. |
| `type` | string | `after_hours`, `long_on`, or `controller_offline`. |
| `room` | string | Room where the alert applies. |
| `message` | string | Human-readable summary from the backend. |
| `since` | string | When the alert condition began. |
| `timestamp` | string | When the alert was last observed. |

Alert rules:

- `after_hours`: if any fan/light in a room is on outside `09:00-17:00` in `Asia/Dhaka`, emit one
  alert for that room.
- `long_on`: if all five fans/lights in a room have been continuously on for more than two hours,
  emit one alert for that room.
- `controller_offline`: if a room controller is `offline`, emit one alert for that room.
- Alerts disappear from `GET /api/alerts` when their condition clears.
- Jifat's bot must deduplicate proactive posts by `alert.id`.

### `HistoryPoint`

```json
{
  "ts": "2026-07-03T15:59:57Z",
  "total_power_w": 375,
  "loads_on": 10
}
```

### `Snapshot`

WebSocket messages always use one message type:

```json
{
  "type": "snapshot",
  "server_time": "2026-07-03T16:00:00Z",
  "devices": [],
  "summary": {},
  "alerts": []
}
```

In real responses, `devices` is an array of `Device`, `summary` is `Summary`, and `alerts` is an
array of `Alert`.

### `ErrorResponse`

All non-2xx JSON errors must use this shape:

```json
{
  "error": {
    "code": "not_found",
    "message": "Device not found.",
    "details": {
      "device_id": "work9-fan-1"
    }
  }
}
```

Common error codes:

| HTTP status | `error.code` | Meaning |
| ---: | --- | --- |
| `400` | `bad_request` | Invalid JSON body or query value. |
| `404` | `not_found` | Unknown room or device. |
| `422` | `validation_error` | Valid JSON but invalid enum/value. |
| `500` | `internal_error` | Unexpected backend failure. |

## 4. REST Endpoints

### `GET /health`

Response `200`:

```json
{
  "status": "ok",
  "server_time": "2026-07-03T16:00:00Z",
  "database": "ok",
  "simulator": {
    "running": true,
    "tick_seconds": 3
  }
}
```

### `GET /api/devices`

Returns all 18 devices.

Response `200`:

```json
{
  "devices": [
    {
      "id": "drawing-fan-1",
      "type": "fan",
      "label": "Fan 1",
      "room": "drawing",
      "status": "on",
      "power_w": 60,
      "power_rated_w": 60,
      "last_changed": "2026-07-03T15:30:00Z"
    }
  ]
}
```

### `GET /api/devices/{device_id}`

Returns one device by ID.

Response `200`:

```json
{
  "device": {
    "id": "work1-light-2",
    "type": "light",
    "label": "Light 2",
    "room": "work1",
    "status": "off",
    "power_w": 0,
    "power_rated_w": 15,
    "last_changed": "2026-07-03T15:55:00Z"
  }
}
```

Response `404`:

```json
{
  "error": {
    "code": "not_found",
    "message": "Device not found.",
    "details": {
      "device_id": "bad-device-id"
    }
  }
}
```

### `GET /api/rooms/{room}`

Returns one room, its six devices, and room totals.

Valid `room` path values:

- `drawing`
- `work1`
- `work2`

Response `200`:

```json
{
  "room": "work1",
  "display_name": "Work Room 1",
  "devices": [
    {
      "id": "work1-fan-1",
      "type": "fan",
      "label": "Fan 1",
      "room": "work1",
      "status": "on",
      "power_w": 60,
      "power_rated_w": 60,
      "last_changed": "2026-07-03T15:50:00Z"
    },
    {
      "id": "work1-fan-2",
      "type": "fan",
      "label": "Fan 2",
      "room": "work1",
      "status": "on",
      "power_w": 60,
      "power_rated_w": 60,
      "last_changed": "2026-07-03T15:40:00Z"
    },
    {
      "id": "work1-light-1",
      "type": "light",
      "label": "Light 1",
      "room": "work1",
      "status": "on",
      "power_w": 15,
      "power_rated_w": 15,
      "last_changed": "2026-07-03T15:42:00Z"
    },
    {
      "id": "work1-light-2",
      "type": "light",
      "label": "Light 2",
      "room": "work1",
      "status": "off",
      "power_w": 0,
      "power_rated_w": 15,
      "last_changed": "2026-07-03T15:55:00Z"
    },
    {
      "id": "work1-light-3",
      "type": "light",
      "label": "Light 3",
      "room": "work1",
      "status": "off",
      "power_w": 0,
      "power_rated_w": 15,
      "last_changed": "2026-07-03T15:20:00Z"
    },
    {
      "id": "work1-controller-1",
      "type": "controller",
      "label": "Controller 1",
      "room": "work1",
      "status": "online",
      "power_w": 0,
      "power_rated_w": 0,
      "last_changed": "2026-07-03T15:00:00Z"
    }
  ],
  "power_w": 135,
  "loads_on": 3,
  "controllers_online": 1,
  "device_count": 6
}
```

### `GET /api/summary`

Returns whole-office totals for dashboard power meter and bot `!usage`.

Response `200`:

```json
{
  "total_power_w": 375,
  "per_room": {
    "drawing": {
      "room": "drawing",
      "display_name": "Drawing Room",
      "power_w": 75,
      "loads_on": 2,
      "controllers_online": 1,
      "device_count": 6
    },
    "work1": {
      "room": "work1",
      "display_name": "Work Room 1",
      "power_w": 135,
      "loads_on": 3,
      "controllers_online": 1,
      "device_count": 6
    },
    "work2": {
      "room": "work2",
      "display_name": "Work Room 2",
      "power_w": 165,
      "loads_on": 5,
      "controllers_online": 1,
      "device_count": 6
    }
  },
  "today_kwh": 4.2,
  "load_count_on": 10,
  "controllers_online": 3,
  "device_count": 18,
  "server_time": "2026-07-03T16:00:00Z"
}
```

### `GET /api/history?minutes=30`

Returns recent power history for a dashboard trend chart.

Query params:

| Name | Type | Default | Valid range |
| --- | --- | ---: | --- |
| `minutes` | integer | `30` | `1` through `180` |

Response `200`:

```json
{
  "minutes": 30,
  "points": [
    {
      "ts": "2026-07-03T15:59:51Z",
      "total_power_w": 270,
      "loads_on": 8
    },
    {
      "ts": "2026-07-03T15:59:54Z",
      "total_power_w": 330,
      "loads_on": 9
    },
    {
      "ts": "2026-07-03T15:59:57Z",
      "total_power_w": 375,
      "loads_on": 10
    }
  ]
}
```

Response `422` for invalid `minutes`:

```json
{
  "error": {
    "code": "validation_error",
    "message": "minutes must be between 1 and 180.",
    "details": {
      "minutes": 999
    }
  }
}
```

### `GET /api/alerts`

Returns active alerts only.

Response `200`:

```json
{
  "alerts": [
    {
      "id": "after_hours-work2-2026-07-03T16",
      "type": "after_hours",
      "room": "work2",
      "message": "Work Room 2 has 2 fans and 3 lights ON after office hours.",
      "since": "2026-07-03T16:00:00Z",
      "timestamp": "2026-07-03T16:00:03Z"
    }
  ]
}
```

### `POST /api/devices/{device_id}/toggle`

Demo helper. Flips one device state:

- Fans/lights: `on` to `off`, or `off` to `on`.
- Controllers: `online` to `offline`, or `offline` to `online`.

Request body: none.

Response `200`:

```json
{
  "device": {
    "id": "work2-light-3",
    "type": "light",
    "label": "Light 3",
    "room": "work2",
    "status": "off",
    "power_w": 0,
    "power_rated_w": 15,
    "last_changed": "2026-07-03T16:01:00Z"
  }
}
```

### `POST /api/devices/{device_id}/state`

Demo helper. Sets one device to a specific state.

Request body for fan/light:

```json
{
  "status": "on"
}
```

Request body for controller:

```json
{
  "status": "online"
}
```

Response `200`:

```json
{
  "device": {
    "id": "work2-controller-1",
    "type": "controller",
    "label": "Controller 1",
    "room": "work2",
    "status": "online",
    "power_w": 0,
    "power_rated_w": 0,
    "last_changed": "2026-07-03T16:01:00Z"
  }
}
```

Response `422` for invalid status:

```json
{
  "error": {
    "code": "validation_error",
    "message": "status is invalid for this device type.",
    "details": {
      "device_id": "work2-controller-1",
      "status": "on"
    }
  }
}
```

### `POST /api/demo/clock`

Demo helper. Overrides backend time for alert demonstrations.

Request body to set override:

```json
{
  "iso": "2026-07-03T16:00:00Z"
}
```

Request body to clear override:

```json
{
  "iso": null
}
```

Response `200`:

```json
{
  "clock": {
    "override_active": true,
    "server_time": "2026-07-03T16:00:00Z",
    "business_timezone": "Asia/Dhaka",
    "local_time": "2026-07-03T22:00:00+06:00"
  }
}
```

### `POST /api/demo/simulator`

Demo helper. Pauses or resumes random simulator flips.

Request body:

```json
{
  "running": false
}
```

Response `200`:

```json
{
  "simulator": {
    "running": false,
    "tick_seconds": 3
  }
}
```

When paused, REST endpoints and manual device controls must still work.

### `GET /api/demo/state`

Returns current demo-control state.

Response `200`:

```json
{
  "clock": {
    "override_active": true,
    "server_time": "2026-07-03T16:00:00Z",
    "business_timezone": "Asia/Dhaka",
    "local_time": "2026-07-03T22:00:00+06:00"
  },
  "simulator": {
    "running": false,
    "tick_seconds": 3
  }
}
```

## 5. WebSocket Contract

### `WS /ws`

Behavior:

- On connect, backend immediately sends one `snapshot`.
- Backend sends another `snapshot` on every simulator tick.
- Backend sends another `snapshot` after manual device changes or demo-control changes.
- The dashboard should reconnect with backoff if the socket closes.
- If WebSocket is unavailable, the dashboard should poll:
  - `GET /api/devices`
  - `GET /api/summary`
  - `GET /api/alerts`

Message:

```json
{
  "type": "snapshot",
  "server_time": "2026-07-03T16:00:00Z",
  "devices": [
    {
      "id": "drawing-fan-1",
      "type": "fan",
      "label": "Fan 1",
      "room": "drawing",
      "status": "on",
      "power_w": 60,
      "power_rated_w": 60,
      "last_changed": "2026-07-03T15:30:00Z"
    }
  ],
  "summary": {
    "total_power_w": 375,
    "per_room": {
      "drawing": {
        "room": "drawing",
        "display_name": "Drawing Room",
        "power_w": 75,
        "loads_on": 2,
        "controllers_online": 1,
        "device_count": 6
      },
      "work1": {
        "room": "work1",
        "display_name": "Work Room 1",
        "power_w": 135,
        "loads_on": 3,
        "controllers_online": 1,
        "device_count": 6
      },
      "work2": {
        "room": "work2",
        "display_name": "Work Room 2",
        "power_w": 165,
        "loads_on": 5,
        "controllers_online": 1,
        "device_count": 6
      }
    },
    "today_kwh": 4.2,
    "load_count_on": 10,
    "controllers_online": 3,
    "device_count": 18,
    "server_time": "2026-07-03T16:00:00Z"
  },
  "alerts": [
    {
      "id": "after_hours-work2-2026-07-03T16",
      "type": "after_hours",
      "room": "work2",
      "message": "Work Room 2 has 2 fans and 3 lights ON after office hours.",
      "since": "2026-07-03T16:00:00Z",
      "timestamp": "2026-07-03T16:00:03Z"
    }
  ]
}
```

## 6. Canonical Fixtures

Jifat and Arif can use these payloads before Saima's backend is ready.

### Full `GET /api/devices` Fixture

```json
{
  "devices": [
    {
      "id": "drawing-fan-1",
      "type": "fan",
      "label": "Fan 1",
      "room": "drawing",
      "status": "on",
      "power_w": 60,
      "power_rated_w": 60,
      "last_changed": "2026-07-03T15:30:00Z"
    },
    {
      "id": "drawing-fan-2",
      "type": "fan",
      "label": "Fan 2",
      "room": "drawing",
      "status": "off",
      "power_w": 0,
      "power_rated_w": 60,
      "last_changed": "2026-07-03T15:45:00Z"
    },
    {
      "id": "drawing-light-1",
      "type": "light",
      "label": "Light 1",
      "room": "drawing",
      "status": "on",
      "power_w": 15,
      "power_rated_w": 15,
      "last_changed": "2026-07-03T15:10:00Z"
    },
    {
      "id": "drawing-light-2",
      "type": "light",
      "label": "Light 2",
      "room": "drawing",
      "status": "off",
      "power_w": 0,
      "power_rated_w": 15,
      "last_changed": "2026-07-03T15:20:00Z"
    },
    {
      "id": "drawing-light-3",
      "type": "light",
      "label": "Light 3",
      "room": "drawing",
      "status": "off",
      "power_w": 0,
      "power_rated_w": 15,
      "last_changed": "2026-07-03T15:25:00Z"
    },
    {
      "id": "drawing-controller-1",
      "type": "controller",
      "label": "Controller 1",
      "room": "drawing",
      "status": "online",
      "power_w": 0,
      "power_rated_w": 0,
      "last_changed": "2026-07-03T15:00:00Z"
    },
    {
      "id": "work1-fan-1",
      "type": "fan",
      "label": "Fan 1",
      "room": "work1",
      "status": "on",
      "power_w": 60,
      "power_rated_w": 60,
      "last_changed": "2026-07-03T15:50:00Z"
    },
    {
      "id": "work1-fan-2",
      "type": "fan",
      "label": "Fan 2",
      "room": "work1",
      "status": "on",
      "power_w": 60,
      "power_rated_w": 60,
      "last_changed": "2026-07-03T15:40:00Z"
    },
    {
      "id": "work1-light-1",
      "type": "light",
      "label": "Light 1",
      "room": "work1",
      "status": "on",
      "power_w": 15,
      "power_rated_w": 15,
      "last_changed": "2026-07-03T15:42:00Z"
    },
    {
      "id": "work1-light-2",
      "type": "light",
      "label": "Light 2",
      "room": "work1",
      "status": "off",
      "power_w": 0,
      "power_rated_w": 15,
      "last_changed": "2026-07-03T15:55:00Z"
    },
    {
      "id": "work1-light-3",
      "type": "light",
      "label": "Light 3",
      "room": "work1",
      "status": "off",
      "power_w": 0,
      "power_rated_w": 15,
      "last_changed": "2026-07-03T15:20:00Z"
    },
    {
      "id": "work1-controller-1",
      "type": "controller",
      "label": "Controller 1",
      "room": "work1",
      "status": "online",
      "power_w": 0,
      "power_rated_w": 0,
      "last_changed": "2026-07-03T15:00:00Z"
    },
    {
      "id": "work2-fan-1",
      "type": "fan",
      "label": "Fan 1",
      "room": "work2",
      "status": "on",
      "power_w": 60,
      "power_rated_w": 60,
      "last_changed": "2026-07-03T13:40:00Z"
    },
    {
      "id": "work2-fan-2",
      "type": "fan",
      "label": "Fan 2",
      "room": "work2",
      "status": "on",
      "power_w": 60,
      "power_rated_w": 60,
      "last_changed": "2026-07-03T13:41:00Z"
    },
    {
      "id": "work2-light-1",
      "type": "light",
      "label": "Light 1",
      "room": "work2",
      "status": "on",
      "power_w": 15,
      "power_rated_w": 15,
      "last_changed": "2026-07-03T13:42:00Z"
    },
    {
      "id": "work2-light-2",
      "type": "light",
      "label": "Light 2",
      "room": "work2",
      "status": "on",
      "power_w": 15,
      "power_rated_w": 15,
      "last_changed": "2026-07-03T13:43:00Z"
    },
    {
      "id": "work2-light-3",
      "type": "light",
      "label": "Light 3",
      "room": "work2",
      "status": "on",
      "power_w": 15,
      "power_rated_w": 15,
      "last_changed": "2026-07-03T13:44:00Z"
    },
    {
      "id": "work2-controller-1",
      "type": "controller",
      "label": "Controller 1",
      "room": "work2",
      "status": "online",
      "power_w": 0,
      "power_rated_w": 0,
      "last_changed": "2026-07-03T15:00:00Z"
    }
  ]
}
```

### Canonical `GET /api/summary` Fixture

```json
{
  "total_power_w": 375,
  "per_room": {
    "drawing": {
      "room": "drawing",
      "display_name": "Drawing Room",
      "power_w": 75,
      "loads_on": 2,
      "controllers_online": 1,
      "device_count": 6
    },
    "work1": {
      "room": "work1",
      "display_name": "Work Room 1",
      "power_w": 135,
      "loads_on": 3,
      "controllers_online": 1,
      "device_count": 6
    },
    "work2": {
      "room": "work2",
      "display_name": "Work Room 2",
      "power_w": 165,
      "loads_on": 5,
      "controllers_online": 1,
      "device_count": 6
    }
  },
  "today_kwh": 4.2,
  "load_count_on": 10,
  "controllers_online": 3,
  "device_count": 18,
  "server_time": "2026-07-03T16:00:00Z"
}
```

### Canonical `GET /api/alerts` Fixture

```json
{
  "alerts": [
    {
      "id": "after_hours-work2-2026-07-03T16",
      "type": "after_hours",
      "room": "work2",
      "message": "Work Room 2 has 2 fans and 3 lights ON after office hours.",
      "since": "2026-07-03T16:00:00Z",
      "timestamp": "2026-07-03T16:00:03Z"
    },
    {
      "id": "long_on-work2-2026-07-03T16",
      "type": "long_on",
      "room": "work2",
      "message": "All fans and lights in Work Room 2 have been ON for more than 2 hours.",
      "since": "2026-07-03T13:44:00Z",
      "timestamp": "2026-07-03T16:00:03Z"
    }
  ]
}
```

## 7. Work Split Guidance

### Saima

- Implement this contract exactly.
- Keep SQLite as the only stored device state.
- Compute alerts and power in the backend only.
- Ship `GET /api/devices`, `GET /api/summary`, and `WS /ws` first so others can integrate early.

### Jifat

- Build `backend_client.py` against this contract.
- Use REST only; do not read SQLite directly.
- Implement command data needs as:
  - `!status`: `GET /api/devices` plus `GET /api/summary`.
  - `!room <name>`: `GET /api/rooms/{room}`.
  - `!usage`: `GET /api/summary`.
  - proactive alerts: poll `GET /api/alerts` every 15 seconds and deduplicate by `alert.id`.
- If the LLM fails, return a simple templated message using the same backend JSON.

### Arif

- Use `WS /ws` as the primary live data source.
- Render dashboard state from the latest `snapshot`.
- Use REST polling only as fallback.
- Do not recompute backend totals or alerts in the frontend.

## 8. Acceptance Checklist

- `GET /api/devices` returns exactly 18 valid devices.
- Every room has exactly two fans, three lights, and one controller.
- `total_power_w` equals the sum of all fan/light `power_w` values.
- `load_count_on` equals the number of fans/lights with `status: "on"`.
- `controllers_online` equals the number of controllers with `status: "online"`.
- Bot `!status` and dashboard show matching state after the same backend tick.
- `POST /api/demo/clock` can force an after-hours alert for the demo.
- `POST /api/demo/simulator` can pause random flips during demo recording.
- WebSocket sends a snapshot immediately on connect.
- Invalid room/device IDs return the documented error envelope.
