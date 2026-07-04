from fastapi import APIRouter

from ..clock import iso_now
from ..db import get_devices, get_history, get_today_kwh
from ..power import build_summary
from ..schemas import HistoryResponse, Summary

router = APIRouter(prefix="/api", tags=["summary"])


@router.get("/summary", response_model=Summary)
def read_summary() -> dict:
    devices = get_devices()
    return build_summary(devices, iso_now(), get_today_kwh())


@router.get("/history", response_model=HistoryResponse)
def read_history(minutes: int = 30) -> dict:
    minutes = max(1, min(minutes, 180))
    return {"minutes": minutes, "points": get_history(limit=minutes * 20)}
