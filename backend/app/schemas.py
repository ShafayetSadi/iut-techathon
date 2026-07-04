from typing import Literal

from pydantic import BaseModel


Room = Literal["drawing", "work1", "work2"]
DeviceType = Literal["fan", "light"]
LoadStatus = Literal["on", "off"]
DeviceStatus = Literal["on", "off"]
AlertType = Literal["after_hours", "long_on"]


class Device(BaseModel):
    id: str
    type: DeviceType
    label: str
    room: Room
    status: DeviceStatus
    power_w: int
    power_rated_w: int
    last_changed: str


class DevicesResponse(BaseModel):
    devices: list[Device]


class DeviceResponse(BaseModel):
    device: Device


class RoomResponse(BaseModel):
    room: Room
    display_name: str
    devices: list[Device]
    power_w: int
    loads_on: int
    device_count: int


class RoomSummary(BaseModel):
    room: Room
    display_name: str
    power_w: int
    loads_on: int
    device_count: int


class Summary(BaseModel):
    total_power_w: int
    per_room: dict[Room, RoomSummary]
    today_kwh: float
    load_count_on: int
    device_count: int
    server_time: str


class Alert(BaseModel):
    id: str
    type: AlertType
    room: Room
    message: str
    since: str
    timestamp: str


class AlertsResponse(BaseModel):
    alerts: list[Alert]


class HistoryPoint(BaseModel):
    ts: str
    total_power_w: int
    loads_on: int


class HistoryResponse(BaseModel):
    minutes: int
    points: list[HistoryPoint]


class DeviceStateRequest(BaseModel):
    status: DeviceStatus


class ClockRequest(BaseModel):
    iso: str | None


class SimulatorRequest(BaseModel):
    running: bool
