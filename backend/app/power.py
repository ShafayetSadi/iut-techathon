from .constants import LOAD_TYPES, ROOMS


def room_summary(room: str, devices: list[dict]) -> dict:
    room_devices = [device for device in devices if device["room"] == room]
    return {
        "room": room,
        "display_name": ROOMS[room],
        "power_w": sum(device["power_w"] for device in room_devices if device["type"] in LOAD_TYPES),
        "loads_on": sum(
            1 for device in room_devices if device["type"] in LOAD_TYPES and device["status"] == "on"
        ),
        "controllers_online": sum(
            1 for device in room_devices if device["type"] == "controller" and device["status"] == "online"
        ),
        "device_count": len(room_devices),
    }


def build_summary(devices: list[dict], server_time: str, today_kwh: float) -> dict:
    per_room = {room: room_summary(room, devices) for room in ROOMS}
    return {
        "total_power_w": sum(summary["power_w"] for summary in per_room.values()),
        "per_room": per_room,
        "today_kwh": today_kwh,
        "load_count_on": sum(summary["loads_on"] for summary in per_room.values()),
        "controllers_online": sum(summary["controllers_online"] for summary in per_room.values()),
        "device_count": len(devices),
        "server_time": server_time,
    }
