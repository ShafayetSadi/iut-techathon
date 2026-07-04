from .alerts import build_alerts
from .clock import iso_now
from .db import get_devices, get_today_kwh
from .power import build_summary


def build_snapshot() -> dict:
    devices = get_devices()
    server_time = iso_now()
    today_kwh = get_today_kwh()
    return {
        "type": "snapshot",
        "server_time": server_time,
        "devices": devices,
        "summary": build_summary(devices, server_time, today_kwh),
        "alerts": build_alerts(devices),
    }
