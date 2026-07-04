from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from .clock import iso_now
from .config import settings
from .db import init_db
from .routers import alerts, demo, devices, summary
from .simulator import simulator_state, start, stop
from .snapshot import build_snapshot
from .ws import manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    start()
    yield
    await stop()


app = FastAPI(title="Lights, Fans, Discord API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(devices.router)
app.include_router(summary.router)
app.include_router(alerts.router)
app.include_router(demo.router)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": "http_error", "message": str(exc.detail), "details": {}}},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    errors = exc.errors()
    first = errors[0] if errors else {}
    error_type = first.get("type", "")
    details: dict = dict(request.path_params)

    if error_type == "json_invalid":
        return JSONResponse(
            status_code=400,
            content={"error": {"code": "bad_request", "message": "Invalid JSON body.", "details": details}},
        )

    loc = [part for part in first.get("loc", ()) if isinstance(part, str) and part not in ("body", "query")]
    field = loc[-1] if loc else None
    if field is not None:
        details[field] = first.get("input")

    message = first.get("msg", "Invalid request.")
    return JSONResponse(
        status_code=422,
        content={"error": {"code": "validation_error", "message": message, "details": details}},
    )


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "server_time": iso_now(),
        "database": "ok",
        "simulator": simulator_state(),
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await manager.connect(websocket)
    try:
        await websocket.send_json(build_snapshot())
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
