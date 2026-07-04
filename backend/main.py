import os

import uvicorn


if __name__ == "__main__":
    # reload is OFF by default: auto-reload restarts the worker on file changes, which can leave the
    # old Discord gateway session briefly connected alongside the new one -> the bot replies twice.
    # Enable it only when iterating on the API without the bot: RELOAD=1 uv run python main.py
    reload = os.getenv("RELOAD") == "1"
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=reload)
