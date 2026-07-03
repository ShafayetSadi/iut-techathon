import asyncio
from contextlib import suppress
from datetime import time
import random

from .clock import BUSINESS_TZ, utc_now
from .config import settings
from .db import append_state_event, get_devices, set_device_status
from .snapshot import build_snapshot
from .ws import manager

_running = True
_task: asyncio.Task | None = None
_rng = random.Random()


def simulator_state() -> dict:
    return {"running": _running, "tick_seconds": settings.tick_seconds}


def set_running(running: bool) -> dict:
    global _running
    _running = running
    return simulator_state()


def _parse_hhmm(value: str) -> time:
    hour, minute = value.split(":", 1)
    return time(int(hour), int(minute))


def _is_office_hours() -> bool:
    local_time = utc_now().astimezone(BUSINESS_TZ).time()
    return _parse_hhmm(settings.office_open) <= local_time <= _parse_hhmm(settings.office_close)


def _flip_weight(device: dict) -> float:
    if device["type"] == "controller":
        if device["status"] == "offline":
            return 0.4
        return 0.05

    if _is_office_hours():
        return 2.0 if device["status"] == "off" else 0.7
    return 2.0 if device["status"] == "on" else 0.7


def _weighted_pick(devices: list[dict], rng: random.Random) -> dict | None:
    total = sum(_flip_weight(device) for device in devices)
    if total <= 0:
        return None

    threshold = rng.uniform(0, total)
    upto = 0.0
    for device in devices:
        upto += _flip_weight(device)
        if upto >= threshold:
            return device
    return devices[-1] if devices else None


def maybe_flip_devices(rng: random.Random = _rng) -> list[dict]:
    devices = get_devices()
    if not devices:
        return []

    remaining = devices[:]
    flips: list[dict] = []
    target_count = min(rng.randint(1, 3), len(remaining))

    while remaining and len(flips) < target_count:
        selected = _weighted_pick(remaining, rng)
        if selected is None:
            break

        remaining = [device for device in remaining if device["id"] != selected["id"]]
        next_status = {
            "on": "off",
            "off": "on",
            "online": "offline",
            "offline": "online",
        }[selected["status"]]
        updated = set_device_status(selected["id"], next_status)
        if updated is not None:
            flips.append(updated)

    return flips


async def _loop() -> None:
    while True:
        await asyncio.sleep(settings.tick_seconds)
        if not _running:
            continue
        maybe_flip_devices()
        snapshot = build_snapshot()
        append_state_event(snapshot["summary"]["total_power_w"], snapshot["summary"]["load_count_on"])
        await manager.broadcast(snapshot)


def start() -> None:
    global _task
    if _task is None:
        _task = asyncio.create_task(_loop())


async def stop() -> None:
    global _task
    if _task is not None:
        _task.cancel()
        with suppress(asyncio.CancelledError):
            await _task
        _task = None
