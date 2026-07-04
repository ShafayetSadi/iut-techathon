"""LLM humanization via OpenRouter, with a deterministic template fallback.

The bot must give real answers from real data, only phrased conversationally. The truth is always
the injected snapshot JSON; the model merely rephrases it. If no key is configured or the call
fails, we fall back to a plain templated string built from the same data so the bot never goes
silent.
"""

import json
import logging

import httpx

from .config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are the office's friendly energy assistant for the 'Lights, Fans, Discord' monitoring "
    "system. Answer ONLY from the JSON data provided in the user message. Never invent devices, "
    "rooms, or numbers. Be concise and warm (1-3 sentences). If a value isn't in the data, say you "
    "don't have it. Power is in watts (W); energy today is in kWh."
)

REQUEST_TIMEOUT = 20.0


def template_fallback(question: str, snapshot: dict) -> str:
    """Plain-language answer built directly from the snapshot summary (no LLM)."""
    summary = snapshot.get("summary", {})
    total_power = summary.get("total_power_w", 0)
    loads_on = summary.get("load_count_on", 0)
    controllers_online = summary.get("controllers_online", 0)
    today_kwh = summary.get("today_kwh", 0)
    alerts = snapshot.get("alerts", [])

    parts = [
        f"Right now the office is pulling about {total_power}W, with {loads_on} loads on "
        f"and {controllers_online} controllers online. You've used ~{today_kwh} kWh today."
    ]
    if alerts:
        messages = "; ".join(alert.get("message", "") for alert in alerts if alert.get("message"))
        parts.append(f"Active alerts: {messages}" if messages else f"{len(alerts)} active alert(s).")
    else:
        parts.append("No active alerts. 💡")
    return " ".join(parts)


async def humanize(question: str, snapshot: dict) -> str:
    """Rephrase the snapshot data to answer `question`. Falls back to a template on any failure."""
    if not settings.openrouter_api_key:
        logger.info("OPENROUTER_API_KEY not set; using template fallback.")
        return template_fallback(question, snapshot)

    user_content = (
        f"Question: {question}\n\n"
        f"Live office data (JSON):\n{json.dumps(snapshot, ensure_ascii=False)}"
    )
    payload = {
        "model": settings.openrouter_model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
    }
    headers = {"Authorization": f"Bearer {settings.openrouter_api_key}"}

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            response = await client.post(
                f"{settings.openrouter_base_url}/chat/completions",
                json=payload,
                headers=headers,
            )
            response.raise_for_status()
            data = response.json()
            reply = data["choices"][0]["message"]["content"].strip()
            return reply or template_fallback(question, snapshot)
    except Exception:  # noqa: BLE001 - never let the bot go silent
        logger.exception("OpenRouter call failed; using template fallback.")
        return template_fallback(question, snapshot)
