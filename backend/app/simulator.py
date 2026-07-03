import asyncio
from contextlib import suppress

from .config import settings
from .db import append_state_event
from .snapshot import build_snapshot
from .ws import manager

_running = True
_task: asyncio.Task | None = None


def simulator_state() -> dict:
    return {"running": _running, "tick_seconds": settings.tick_seconds}


def set_running(running: bool) -> dict:
    global _running
    _running = running
    return simulator_state()


async def _loop() -> None:
    while True:
        await asyncio.sleep(settings.tick_seconds)
        if not _running:
            continue
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
