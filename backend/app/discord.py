"""In-process Discord bot.

Flow: a user runs `!ask <question>` in Discord -> this bot forwards it to the server's
`POST /api/chat` endpoint -> the server enriches it with live office data and calls the LLM ->
the reply comes back and the bot posts it in Discord.

The bot is started/stopped from the FastAPI `lifespan` (see app/main.py), mirroring the simulator.
If no `DISCORD_TOKEN` is configured, `start()` is a no-op so the server still boots.
"""

import asyncio
import logging

import discord
import httpx
from discord.ext import commands

from .config import settings

logger = logging.getLogger(__name__)

REQUEST_TIMEOUT = 30.0
DISCORD_MAX_LEN = 2000

_intents = discord.Intents.default()
_intents.message_content = True

bot = commands.Bot(command_prefix=settings.bot_command_prefix, intents=_intents)

_task: asyncio.Task | None = None


@bot.event
async def on_ready() -> None:
    logger.info("Discord bot connected as %s", bot.user)


@bot.command(name="ask")
async def ask(ctx: commands.Context, *, question: str = "") -> None:
    """Answer a question about the office using live data via the server's /api/chat endpoint."""
    question = question.strip()
    if not question:
        await ctx.reply(f"Ask me something, e.g. `{settings.bot_command_prefix}ask what's the office power usage?`")
        return

    async with ctx.typing():
        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                response = await client.post(
                    f"{settings.api_base}/api/chat",
                    json={"message": question, "user": str(ctx.author)},
                )
                response.raise_for_status()
                reply = response.json().get("reply", "").strip()
        except Exception:  # noqa: BLE001 - always give the user feedback
            logger.exception("Failed to reach /api/chat")
            await ctx.reply("Sorry, I couldn't reach the office server just now. Please try again.")
            return

    await ctx.reply(reply[:DISCORD_MAX_LEN] if reply else "I don't have an answer for that right now.")


def start() -> None:
    """Launch the Discord client in the background. No-op if no token is configured."""
    global _task
    if not settings.discord_token:
        logger.warning("DISCORD_TOKEN not set; Discord bot disabled. Set it in backend/.env to enable.")
        return
    if _task is None:
        _task = asyncio.create_task(bot.start(settings.discord_token))
        logger.info("Discord bot starting...")


async def stop() -> None:
    """Close the Discord client if running."""
    global _task
    if _task is not None:
        await bot.close()
        _task = None
        logger.info("Discord bot stopped.")
