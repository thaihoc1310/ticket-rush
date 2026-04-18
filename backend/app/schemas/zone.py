from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class ZoneBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    price: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    color: str = Field(default="#4f46e5", pattern=r"^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$")


class ZoneCreate(ZoneBase):
    pass


class ZoneUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    price: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    color: str | None = Field(
        default=None, pattern=r"^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$"
    )


class ZoneOut(ZoneBase):
    id: UUID
    event_id: UUID
    seat_count: int = 0

    class Config:
        from_attributes = True


class BulkAssignRequest(BaseModel):
    seat_ids: list[UUID] = Field(min_length=1)
    zone_id: UUID | None  # None = unassign
