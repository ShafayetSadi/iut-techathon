from fastapi import APIRouter

from ..clock import clock_state, set_override
from ..schemas import ClockRequest, SimulatorRequest
from ..simulator import set_running, simulator_state
from ..snapshot import build_snapshot
from ..ws import manager

router = APIRouter(prefix="/api/demo", tags=["demo"])


@router.post("/clock")
async def set_clock(request: ClockRequest) -> dict:
    set_override(request.iso)
    await manager.broadcast(build_snapshot())
    return {"clock": clock_state()}


@router.post("/simulator")
async def update_simulator(request: SimulatorRequest) -> dict:
    state = set_running(request.running)
    await manager.broadcast(build_snapshot())
    return {"simulator": state}


@router.get("/state")
def read_demo_state() -> dict:
    return {"clock": clock_state(), "simulator": simulator_state()}
