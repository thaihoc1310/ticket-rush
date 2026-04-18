from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel

from app.utils.enums import SeatStatus


class SeatOut(BaseModel):
    id: UUID
    event_id: UUID
    zone_id: UUID | None
    row_number: int
    seat_number: int
    status: SeatStatus
    locked_by: UUID | None

    class Config:
        from_attributes = True


class SeatWithZone(BaseModel):
    id: UUID
    event_id: UUID
    zone_id: UUID | None
    zone_name: str | None
    zone_color: str | None
    price: Decimal | None
    row_number: int
    seat_number: int
    status: SeatStatus
    locked_by: UUID | None


class SeatLockResponse(BaseModel):
    seat_id: UUID
    status: SeatStatus
    expires_in: int
