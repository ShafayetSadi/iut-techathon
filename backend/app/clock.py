from datetime import UTC, datetime

from zoneinfo import ZoneInfo

BUSINESS_TZ = ZoneInfo("Asia/Dhaka")
_override_now: datetime | None = None


def utc_now() -> datetime:
    return _override_now or datetime.now(UTC)


def iso_now() -> str:
    return utc_now().isoformat().replace("+00:00", "Z")


def set_override(iso: str | None) -> None:
    global _override_now
    if iso is None:
        _override_now = None
        return
    value = iso.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(value)
    _override_now = parsed.astimezone(UTC)


def clock_state() -> dict:
    now = utc_now()
    return {
        "override_active": _override_now is not None,
        "server_time": now.isoformat().replace("+00:00", "Z"),
        "business_timezone": "Asia/Dhaka",
        "local_time": now.astimezone(BUSINESS_TZ).isoformat(),
    }
