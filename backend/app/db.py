import sqlite3
from contextlib import contextmanager
from pathlib import Path

from .clock import iso_now
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
            status = "online" if device_type == "controller" else "off"
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


def get_history(limit: int = 600) -> list[dict]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT ts, total_power_w, loads_on FROM state_events ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [dict(row) for row in reversed(rows)]
