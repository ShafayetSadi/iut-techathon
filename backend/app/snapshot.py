from .alerts import build_alerts
from .clock import iso_now
from .db import get_devices
from .power import build_summary


def build_snapshot() -> dict:
    devices = get_devices()
    server_time = iso_now()
    return {
        "type": "snapshot",
        "server_time": server_time,
        "devices": devices,
        "summary": build_summary(devices, server_time),
        "alerts": build_alerts(devices),
    }
