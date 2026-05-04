from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from app.utils.enums import BookingStatus, PaymentStatus, TicketStatus


class BookingCreate(BaseModel):
    event_id: UUID
    seat_ids: list[UUID] = Field(min_length=1, max_length=20)


class BookingItemOut(BaseModel):
    id: UUID
    seat_id: UUID
    row_number: int
    seat_number: int
    zone_name: str
    price: Decimal

    class Config:
        from_attributes = True


class PaymentOut(BaseModel):
    id: UUID
    amount: Decimal
    method: str
    status: PaymentStatus
    paid_at: datetime | None

    class Config:
        from_attributes = True


class BookingOut(BaseModel):
    id: UUID
    event_id: UUID
    event_title: str
    event_date: datetime
    status: BookingStatus
    total_amount: Decimal
    created_at: datetime
    expires_at: datetime
    items: list[BookingItemOut]
    payment: PaymentOut | None


class TicketOut(BaseModel):
    id: UUID
    booking_item_id: UUID
    qr_data: str
    qr_image: str  # data-URL PNG
    status: TicketStatus
    issued_at: datetime
    event_id: UUID
    event_title: str
    event_status: str
    event_date: datetime
    venue_name: str
    venue_address: str
    price: Decimal
    zone_name: str
    row_number: int
    seat_number: int
