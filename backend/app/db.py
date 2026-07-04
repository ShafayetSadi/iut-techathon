import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
import random

from .clock import BUSINESS_TZ, iso_now, utc_now
from .config import settings
from .constants import DEVICE_LAYOUT, ROOMS


def _db_path() -> Path:
    return Path(settings.sqlite_path)


@contextmanager
def connect():
    path = _db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS devices (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                label TEXT NOT NULL,
                room TEXT NOT NULL,
                status TEXT NOT NULL,
                power_rated_w INTEGER NOT NULL,
                last_changed TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS state_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ts TEXT NOT NULL,
                total_power_w INTEGER NOT NULL,
                loads_on INTEGER NOT NULL
            )
            """
        )
        count = conn.execute("SELECT COUNT(*) FROM devices").fetchone()[0]
        if count == 0:
            seed_devices(conn)


def seed_devices(conn: sqlite3.Connection) -> None:
    now = iso_now()
    for room in ROOMS:
        for device_type, number, rated_w in DEVICE_LAYOUT:
            status = initial_device_status(device_type)
            conn.execute(
                """
                INSERT INTO devices (id, type, label, room, status, power_rated_w, last_changed)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    f"{room}-{device_type}-{number}",
                    device_type,
                    f"{device_type.title()} {number}",
                    room,
                    status,
                    rated_w,
                    now,
                ),
            )


def initial_device_status(device_type: str) -> str:
    if device_type == "controller":
        return random.choices(["online", "offline"], weights=[9, 1], k=1)[0]
    return random.choice(["on", "off"])


def row_to_device(row: sqlite3.Row) -> dict:
    status = row["status"]
    is_on_load = row["type"] in {"fan", "light"} and status == "on"
    return {
        "id": row["id"],
        "type": row["type"],
        "label": row["label"],
        "room": row["room"],
        "status": status,
        "power_w": row["power_rated_w"] if is_on_load else 0,
        "power_rated_w": row["power_rated_w"],
        "last_changed": row["last_changed"],
    }


def get_devices() -> list[dict]:
    with connect() as conn:
        rows = conn.execute("SELECT * FROM devices ORDER BY room, type, id").fetchall()
        return [row_to_device(row) for row in rows]


def get_device(device_id: str) -> dict | None:
    with connect() as conn:
        row = conn.execute("SELECT * FROM devices WHERE id = ?", (device_id,)).fetchone()
        return row_to_device(row) if row else None


def set_device_status(device_id: str, status: str) -> dict | None:
    with connect() as conn:
        row = conn.execute("SELECT * FROM devices WHERE id = ?", (device_id,)).fetchone()
        if row is None:
            return None
        conn.execute(
            "UPDATE devices SET status = ?, last_changed = ? WHERE id = ?",
            (status, iso_now(), device_id),
        )
    return get_device(device_id)


def append_state_event(total_power_w: int, loads_on: int) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO state_events (ts, total_power_w, loads_on) VALUES (?, ?, ?)",
            (iso_now(), total_power_w, loads_on),
        )


def _parse_iso_utc(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def get_today_kwh() -> float:
    now = utc_now()
    local_midnight = now.astimezone(BUSINESS_TZ).replace(hour=0, minute=0, second=0, microsecond=0)
    midnight_utc = local_midnight.astimezone(now.tzinfo)

    with connect() as conn:
        rows = conn.execute(
            """
            SELECT ts, total_power_w
            FROM state_events
            WHERE ts >= ?
            ORDER BY ts ASC
            """,
            (midnight_utc.isoformat().replace("+00:00", "Z"),),
        ).fetchall()

    if not rows:
        return 0.0

    watt_seconds = 0.0
    for index, row in enumerate(rows):
        start = _parse_iso_utc(row["ts"])
        end = now if index == len(rows) - 1 else _parse_iso_utc(rows[index + 1]["ts"])
        elapsed_seconds = max(0.0, (end - start).total_seconds())
        watt_seconds += row["total_power_w"] * elapsed_seconds

    return watt_seconds / 3_600_000


def get_history(limit: int = 600) -> list[dict]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT ts, total_power_w, loads_on FROM state_events ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [dict(row) for row in reversed(rows)]
