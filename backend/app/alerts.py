from datetime import datetime, time, timedelta

from .clock import BUSINESS_TZ, iso_now, utc_now
from .config import settings
from .constants import LOAD_TYPES, ROOMS


def _parse_hhmm(value: str) -> time:
    hour, minute = value.split(":", 1)
    return time(int(hour), int(minute))


def _is_after_hours() -> bool:
    local_time = utc_now().astimezone(BUSINESS_TZ).time()
    return not (_parse_hhmm(settings.office_open) <= local_time <= _parse_hhmm(settings.office_close))


def _parse_iso_utc(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def build_alerts(devices: list[dict]) -> list[dict]:
    now = iso_now()
    alerts: list[dict] = []
    for room, display_name in ROOMS.items():
        room_devices = [device for device in devices if device["room"] == room]
        loads = [device for device in room_devices if device["type"] in LOAD_TYPES]
        on_loads = [device for device in loads if device["status"] == "on"]
        controller = next((device for device in room_devices if device["type"] == "controller"), None)

        if _is_after_hours() and on_loads:
            fans_on = sum(1 for device in on_loads if device["type"] == "fan")
            lights_on = sum(1 for device in on_loads if device["type"] == "light")
            alerts.append(
                {
                    "id": f"after_hours-{room}-{now[:13]}",
                    "type": "after_hours",
                    "room": room,
                    "message": f"{display_name} has {fans_on} fans and {lights_on} lights ON after office hours.",
                    "since": min(device["last_changed"] for device in on_loads),
                    "timestamp": now,
                }
            )

        if len(loads) == 5 and len(on_loads) == 5:
            since = min(device["last_changed"] for device in on_loads)
            if utc_now() - _parse_iso_utc(since) > timedelta(hours=2):
                alerts.append(
                    {
                        "id": f"long_on-{room}-{now[:13]}",
                        "type": "long_on",
                        "room": room,
                        "message": f"All fans and lights in {display_name} have been ON for more than 2 hours.",
                        "since": since,
                        "timestamp": now,
                    }
                )

        if controller and controller["status"] == "offline":
            alerts.append(
                {
                    "id": f"controller_offline-{room}",
                    "type": "controller_offline",
                    "room": room,
                    "message": f"{display_name} controller is offline.",
                    "since": controller["last_changed"],
                    "timestamp": now,
                }
            )

    return alerts
