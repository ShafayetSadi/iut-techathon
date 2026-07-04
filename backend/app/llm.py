"""LLM humanization via OpenRouter, with a deterministic template fallback.

The bot must give real answers from real data, only phrased conversationally. The truth is always
the injected snapshot JSON; the model merely rephrases it. If no key is configured or the call
fails, we fall back to a plain templated string built from the same data so the bot never goes
silent.
"""

import asyncio
import json
import logging

import httpx

from .clock import local_label
from .config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are the office's friendly energy assistant for the 'Lights, Fans, Discord' monitoring "
    "system. Answer ONLY from the JSON data provided in the user message. Never invent devices, "
    "rooms, or numbers. Be concise and warm, and avoid robotic data dumps. Power is in watts (W); "
    "energy today is in kWh.\n"
    "When asked for the status of all rooms, give one short line per room in the style "
    "\"Drawing Room: 1 fan ON, 2 lights ON\" (or \"all off\"); count devices from the JSON where "
    "type is 'fan'/'light' and status is 'on'. When asked about usage, state total power in watts "
    "and today's estimated energy in kWh, e.g. \"Total power right now: 740W. Today's estimated "
    "usage: 4.2 kWh.\" Mention the current office-local time (given as 'Current local time' in the "
    "user message) when it's relevant, especially for anything after office hours (9 AM-5 PM). "
    "If a value isn't in the data, say you don't have it."
)

# Keep this comfortably below the bot's per-command timeout so a slow model degrades to the
# (accurate) template fallback quickly instead of hanging the Discord command.
REQUEST_TIMEOUT = 15.0
MAX_TOKENS = 350


def _per_room_breakdown(snapshot: dict) -> list[str]:
    """One human line per room: 'Drawing Room: 1 fan ON, 2 lights ON' / 'all off'."""
    devices = snapshot.get("devices", [])
    # Preserve room order and pick up display names from device rooms.
    room_order: list[str] = []
    for device in devices:
        room = device.get("room")
        if room and room not in room_order:
            room_order.append(room)

    lines: list[str] = []
    for room in room_order:
        room_devices = [d for d in devices if d.get("room") == room]
        fans_on = sum(1 for d in room_devices if d.get("type") == "fan" and d.get("status") == "on")
        lights_on = sum(1 for d in room_devices if d.get("type") == "light" and d.get("status") == "on")
        label = _ROOM_LABELS.get(room, room)
        if fans_on == 0 and lights_on == 0:
            lines.append(f"{label}: all off")
        else:
            parts = []
            if fans_on:
                parts.append(f"{fans_on} fan{'s' if fans_on != 1 else ''} ON")
            if lights_on:
                parts.append(f"{lights_on} light{'s' if lights_on != 1 else ''} ON")
            lines.append(f"{label}: {', '.join(parts)}")
    return lines


_ROOM_LABELS = {"drawing": "Drawing Room", "work1": "Work Room 1", "work2": "Work Room 2"}


def template_fallback(question: str, snapshot: dict) -> str:
    """Plain-language answer built directly from the snapshot (no LLM). Real numbers, always."""
    summary = snapshot.get("summary", {})
    total_power = summary.get("total_power_w", 0)
    today_kwh = summary.get("today_kwh", 0)
    alerts = snapshot.get("alerts", [])

    time_label = local_label(snapshot.get("server_time"))
    breakdown = _per_room_breakdown(snapshot)
    parts = [f"As of {time_label} —"]
    if breakdown:
        parts.append(". ".join(breakdown) + ".")
    parts.append(
        f"Total power right now: {total_power}W. Today's estimated usage: {round(today_kwh, 2)} kWh."
    )
    if alerts:
        messages = "; ".join(alert.get("message", "") for alert in alerts if alert.get("message"))
        parts.append(f"⚠️ Active alerts: {messages}" if messages else f"{len(alerts)} active alert(s).")
    return " ".join(parts)


async def humanize(question: str, snapshot: dict) -> str:
    """Rephrase the snapshot data to answer `question`. Falls back to a template on any failure."""
    if not settings.openrouter_api_key:
        logger.info("OPENROUTER_API_KEY not set; using template fallback.")
        return template_fallback(question, snapshot)

    user_content = (
        f"Question: {question}\n"
        f"Current local time: {local_label(snapshot.get('server_time'))} (Asia/Dhaka).\n\n"
        f"Live office data (JSON):\n{json.dumps(snapshot, ensure_ascii=False)}"
    )
    payload = {
        "model": settings.openrouter_model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
        "max_tokens": MAX_TOKENS,
    }
    headers = {"Authorization": f"Bearer {settings.openrouter_api_key}"}

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            # Hard wall-clock deadline: OpenRouter streams keep-alive comments that reset httpx's
            # per-read timeout, so wrap the call to guarantee we fall back in bounded time.
            response = await asyncio.wait_for(
                client.post(
                    f"{settings.openrouter_base_url}/chat/completions",
                    json=payload,
                    headers=headers,
                ),
                timeout=REQUEST_TIMEOUT,
            )
            response.raise_for_status()
            data = response.json()
            reply = (data["choices"][0]["message"]["content"] or "").strip()
            return reply or template_fallback(question, snapshot)
    except Exception:  # noqa: BLE001 - never let the bot go silent
        logger.exception("OpenRouter call failed; using template fallback.")
        return template_fallback(question, snapshot)
