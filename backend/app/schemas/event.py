from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.venue import VenueOut
from app.utils.enums import EventStatus


class EventImageOut(BaseModel):
    id: UUID
    image_url: str
    is_main: bool
    display_order: int

    class Config:
        from_attributes = True


class EventBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    event_date: datetime
    sale_start_at: datetime | None = None
    banner_url: str | None = Field(default=None, max_length=500)
    status: EventStatus = EventStatus.DRAFT
    grid_rows: int = Field(default=10, ge=1, le=100)
    grid_cols: int = Field(default=15, ge=1, le=100)
    category: str | None = Field(default=None, max_length=60)


class EventCreate(EventBase):
    venue_id: UUID


class EventUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    event_date: datetime | None = None
    sale_start_at: datetime | None = None
    banner_url: str | None = Field(default=None, max_length=500)
    status: EventStatus | None = None
    venue_id: UUID | None = None
    category: str | None = Field(default=None, max_length=60)
    # grid dims are immutable after creation (seats are already generated)


class EventSummary(BaseModel):
    id: UUID
    title: str
    description: str | None
    event_date: datetime
    sale_start_at: datetime | None
    banner_url: str | None
    status: EventStatus
    venue: VenueOut
    grid_rows: int
    grid_cols: int
    category: str | None = None
    images: list[EventImageOut] = []

    class Config:
        from_attributes = True


class EventDetail(EventSummary):
    pass


class FilterMeta(BaseModel):
    min_price: float
    max_price: float
    cities: list[str]
    categories: list[str]
