from fastapi import APIRouter

from ..constants import ROOMS
from ..db import get_device, get_devices, set_device_status
from ..errors import not_found, validation_error
from ..power import room_summary
from ..schemas import DeviceResponse, DevicesResponse, DeviceStateRequest, RoomResponse
from ..snapshot import build_snapshot
from ..ws import manager

router = APIRouter(prefix="/api", tags=["devices"])


@router.get("/devices", response_model=DevicesResponse)
def list_devices() -> dict:
    return {"devices": get_devices()}


@router.get("/devices/{device_id}", response_model=DeviceResponse)
def read_device(device_id: str) -> dict:
    device = get_device(device_id)
    if device is None:
        raise not_found("Device not found.", device_id=device_id)
    return {"device": device}


@router.get("/rooms/{room}", response_model=RoomResponse)
def read_room(room: str) -> dict:
    if room not in ROOMS:
        raise not_found("Room not found.", room=room)
    devices = [device for device in get_devices() if device["room"] == room]
    return {**room_summary(room, devices), "devices": devices}


@router.post("/devices/{device_id}/toggle", response_model=DeviceResponse)
async def toggle_device(device_id: str) -> dict:
    device = get_device(device_id)
    if device is None:
        raise not_found("Device not found.", device_id=device_id)
    next_status = "off" if device["status"] == "on" else "on"
    updated = set_device_status(device_id, next_status)
    await manager.broadcast(build_snapshot())
    return {"device": updated}


@router.post("/devices/{device_id}/state", response_model=DeviceResponse)
async def set_device_state(device_id: str, request: DeviceStateRequest) -> dict:
    device = get_device(device_id)
    if device is None:
        raise not_found("Device not found.", device_id=device_id)
    valid_statuses = {"on", "off"}
    if request.status not in valid_statuses:
        raise validation_error(
            "status is invalid for this device type.",
            device_id=device_id,
            status=request.status,
        )
    updated = set_device_status(device_id, request.status)
    await manager.broadcast(build_snapshot())
    return {"device": updated}
