from fastapi import APIRouter

from ..alerts import build_alerts
from ..db import get_devices
from ..schemas import AlertsResponse

router = APIRouter(prefix="/api", tags=["alerts"])


@router.get("/alerts", response_model=AlertsResponse)
def read_alerts() -> dict:
    return {"alerts": build_alerts(get_devices())}
