from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class SummaryOut(BaseModel):
    total_revenue: Decimal
    confirmed_bookings: int
    total_tickets: int
    registered_users: int
    upcoming_events: int
    published_events: int


class RevenuePoint(BaseModel):
    date: date
    revenue: Decimal
    bookings: int


class OccupancyZone(BaseModel):
    zone_id: UUID
    name: str
    color: str
    total: int
    sold: int
    locked: int
    available: int


class OccupancyOut(BaseModel):
    event_id: UUID
    event_title: str
    event_date: datetime
    total_seats: int
    sold: int
    locked: int
    available: int
    unassigned: int
    by_zone: list[OccupancyZone]


class GenderBucket(BaseModel):
    gender: str  # "MALE" | "FEMALE" | "OTHER" | "UNKNOWN"
    count: int


class AgeBucket(BaseModel):
    bracket: str  # e.g. "<18", "18-24", "25-34", "35-44", "45-54", "55+", "unknown"
    count: int


class DemographicsOut(BaseModel):
    by_gender: list[GenderBucket]
    by_age: list[AgeBucket]
    total: int
