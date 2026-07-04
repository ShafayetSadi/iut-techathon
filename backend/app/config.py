from dataclasses import dataclass
from pathlib import Path
import os

from dotenv import load_dotenv

# Load backend/.env (robust to the current working directory) before reading env vars.
load_dotenv(Path(__file__).resolve().parents[1] / ".env")


@dataclass(frozen=True)
class Settings:
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./office.db")
    tick_seconds: int = int(os.getenv("TICK_SECONDS", "3"))
    cors_origins: tuple[str, ...] = tuple(
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
        if origin.strip()
    )
    office_open: str = os.getenv("OFFICE_OPEN", "09:00")
    office_close: str = os.getenv("OFFICE_CLOSE", "17:00")

    # Discord bot + LLM (OpenRouter) settings.
    discord_token: str = os.getenv("DISCORD_TOKEN", "")
    bot_command_prefix: str = os.getenv("BOT_COMMAND_PREFIX", "!")
    api_base: str = os.getenv("API_BASE", "http://localhost:8000")
    openrouter_api_key: str = os.getenv("OPENROUTER_API_KEY", "")
    openrouter_model: str = os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct:free")
    openrouter_base_url: str = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")

    # Proactive alert posting (bonus). Leave ALERT_CHANNEL_ID empty to disable.
    alert_channel_id: int | None = (
        int(os.environ["ALERT_CHANNEL_ID"]) if os.getenv("ALERT_CHANNEL_ID") else None
    )
    alert_poll_seconds: int = int(os.getenv("ALERT_POLL_SECONDS", "15"))

    @property
    def sqlite_path(self) -> str:
        prefix = "sqlite:///"
        if not self.database_url.startswith(prefix):
            raise ValueError("Only sqlite:/// DATABASE_URL values are supported for the prelim backend.")
        return self.database_url.removeprefix(prefix)


settings = Settings()
