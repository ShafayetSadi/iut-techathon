"""In-process Discord bot.

Commands (all read the same backend as the dashboard, so they never disagree):
  !status         -> on/off breakdown of every room
  !room <name>    -> status of one room (e.g. !room work1)
  !usage          -> total power now + today's estimated kWh
  !ask <question> -> free-form question about the office

Each command forwards to the server's `POST /api/chat`, which injects the live snapshot
(devices + summary + alerts) and humanizes the reply via the LLM (with a template fallback).

Bonus: `alert_poller` polls `GET /api/alerts` and posts newly-triggered alerts to a designated
channel (`ALERT_CHANNEL_ID`).

The bot is started/stopped from the FastAPI `lifespan` (see app/main.py), mirroring the simulator.
If no `DISCORD_TOKEN` is configured, `start()` is a no-op so the server still boots.
"""

import asyncio
import logging

import discord
import httpx
from discord.ext import commands, tasks

from .config import settings

logger = logging.getLogger(__name__)

# Must exceed the server's LLM timeout (llm.REQUEST_TIMEOUT) so /api/chat always answers (LLM or
# template fallback) before the bot gives up.
REQUEST_TIMEOUT = 25.0
DISCORD_MAX_LEN = 2000

STATUS_PROMPT = (
    "Give the on/off status of every room. For each room, on its own line, list how many fans and "
    "how many lights are ON in the style 'Drawing Room: 1 fan ON, 2 lights ON' (or 'all off')."
)
USAGE_PROMPT = (
    "What is the office's total power draw right now (in watts) and today's estimated energy use "
    "(in kWh)? Answer in the style 'Total power right now: 740W. Today's estimated usage: 4.2 kWh.'"
)

# Accepted spellings -> canonical room id (see app/constants.py::ROOMS).
_ROOM_ALIASES = {
    "drawing": "drawing", "drawing room": "drawing", "draw": "drawing",
    "work1": "work1", "work 1": "work1", "work room 1": "work1", "workroom1": "work1", "w1": "work1",
    "work2": "work2", "work 2": "work2", "work room 2": "work2", "workroom2": "work2", "w2": "work2",
}
_ROOM_LABELS = {"drawing": "Drawing Room", "work1": "Work Room 1", "work2": "Work Room 2"}

_intents = discord.Intents.default()
_intents.message_content = True

bot = commands.Bot(command_prefix=settings.bot_command_prefix, intents=_intents)

_task: asyncio.Task | None = None
_announced_alert_ids: set[str] = set()


async def _ask_server(question: str, user: str) -> str:
    """POST the question to /api/chat and return the humanized reply (raises on transport error)."""
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        response = await client.post(
            f"{settings.api_base}/api/chat",
            json={"message": question, "user": user},
        )
        response.raise_for_status()
        return response.json().get("reply", "").strip()


async def _respond(ctx: commands.Context, question: str) -> None:
    """Run a question through the server and reply in-channel, with graceful error handling."""
    async with ctx.typing():
        try:
            reply = await _ask_server(question, str(ctx.author))
        except Exception:  # noqa: BLE001 - always give the user feedback
            logger.exception("Failed to reach /api/chat")
            await ctx.reply("Sorry, I couldn't reach the office server just now. Please try again.")
            return
    await ctx.reply(reply[:DISCORD_MAX_LEN] if reply else "I don't have an answer for that right now.")


@bot.event
async def on_ready() -> None:
    logger.info("Discord bot connected as %s", bot.user)
    if settings.alert_channel_id:
        if not alert_poller.is_running():
            alert_poller.start()
            logger.info("Proactive alert poller started (channel %s).", settings.alert_channel_id)
    else:
        logger.warning("ALERT_CHANNEL_ID not set; proactive alerts disabled.")


@bot.command(name="status", help="On/off breakdown of every room.")
async def status(ctx: commands.Context) -> None:
    await _respond(ctx, STATUS_PROMPT)


@bot.command(name="usage", help="Total power now and today's estimated kWh.")
async def usage(ctx: commands.Context) -> None:
    await _respond(ctx, USAGE_PROMPT)


@bot.command(name="room", help="Status of one room, e.g. !room work1")
async def room(ctx: commands.Context, *, name: str = "") -> None:
    key = " ".join(name.lower().split())
    canonical = _ROOM_ALIASES.get(key)
    if canonical is None:
        await ctx.reply(
            "Which room? Try `!room drawing`, `!room work1`, or `!room work2`."
        )
        return
    label = _ROOM_LABELS[canonical]
    await _respond(
        ctx,
        f"What is the status of {label} (room id '{canonical}')? List the fans and lights that are "
        f"ON in that room and its current power draw. Only mention {label}.",
    )


@bot.command(name="ask", help="Ask anything about the office, e.g. !ask are any lights on after hours?")
async def ask(ctx: commands.Context, *, question: str = "") -> None:
    question = question.strip()
    if not question:
        await ctx.reply(
            f"Ask me something, e.g. `{settings.bot_command_prefix}ask what's the office power usage?`"
        )
        return
    await _respond(ctx, question)


@tasks.loop(seconds=settings.alert_poll_seconds)
async def alert_poller() -> None:
    """Post newly-triggered alerts to the designated channel; never re-posts the same alert."""
    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            response = await client.get(f"{settings.api_base}/api/alerts")
            response.raise_for_status()
            alerts = response.json().get("alerts", [])
    except Exception:  # noqa: BLE001 - a transient poll failure must not kill the loop
        logger.exception("Alert poll failed.")
        return

    channel = bot.get_channel(settings.alert_channel_id)
    if channel is None:
        try:
            channel = await bot.fetch_channel(settings.alert_channel_id)
        except Exception:  # noqa: BLE001
            logger.error("ALERT_CHANNEL_ID %s not found or not accessible.", settings.alert_channel_id)
            return

    active_ids: set[str] = set()
    for alert in alerts:
        alert_id = alert.get("id")
        if not alert_id:
            continue
        active_ids.add(alert_id)
        if alert_id not in _announced_alert_ids:
            try:
                await channel.send(f"⚠️ {alert.get('message', 'Alert triggered.')}")
                _announced_alert_ids.add(alert_id)
            except Exception:  # noqa: BLE001
                logger.exception("Failed to post alert %s", alert_id)

    # Forget cleared alerts so memory stays bounded (and a re-triggered condition can re-announce).
    _announced_alert_ids.intersection_update(active_ids)


@alert_poller.before_loop
async def _before_alert_poller() -> None:
    await bot.wait_until_ready()


async def _runner() -> None:
    """Run the gateway client, surfacing login/connection failures instead of swallowing them."""
    try:
        await bot.start(settings.discord_token)
    except discord.LoginFailure:
        logger.error("Discord login failed: invalid DISCORD_TOKEN. Check backend/.env.")
    except discord.PrivilegedIntentsRequired:
        logger.error(
            "Discord rejected the connection: enable the MESSAGE CONTENT INTENT for the bot in the "
            "Developer Portal (Bot tab)."
        )
    except asyncio.CancelledError:
        raise
    except Exception:  # noqa: BLE001 - a bot failure must not take down the API
        logger.exception("Discord bot crashed.")


def start() -> None:
    """Launch the Discord client in the background. No-op if no token is configured."""
    global _task
    if not settings.discord_token:
        logger.warning("DISCORD_TOKEN not set; Discord bot disabled. Set it in backend/.env to enable.")
        return
    if _task is None:
        # Make discord.py's own logs and this module's INFO logs visible under uvicorn.
        discord.utils.setup_logging(level=logging.INFO, root=True)
        logger.info("Discord bot starting...")
        _task = asyncio.create_task(_runner())


async def stop() -> None:
    """Close the Discord client if running."""
    global _task
    if _task is not None:
        if alert_poller.is_running():
            alert_poller.cancel()
        await bot.close()
        _task = None
        logger.info("Discord bot stopped.")
