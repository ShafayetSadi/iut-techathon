from dataclasses import dataclass
import os


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

    @property
    def sqlite_path(self) -> str:
        prefix = "sqlite:///"
        if not self.database_url.startswith(prefix):
            raise ValueError("Only sqlite:/// DATABASE_URL values are supported for the prelim backend.")
        return self.database_url.removeprefix(prefix)


settings = Settings()
