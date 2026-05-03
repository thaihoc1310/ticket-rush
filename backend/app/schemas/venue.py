from uuid import UUID

from pydantic import BaseModel, Field


class VenueBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    address: str = Field(min_length=1, max_length=500)
    city: str = Field(min_length=1, max_length=120)
    grid_rows: int = Field(ge=1, le=100)
    grid_cols: int = Field(ge=1, le=100)


class VenueCreate(VenueBase):
    pass


class VenueUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    address: str | None = Field(default=None, min_length=1, max_length=500)
    city: str | None = Field(default=None, min_length=1, max_length=120)
    grid_rows: int | None = Field(default=None, ge=1, le=100)
    grid_cols: int | None = Field(default=None, ge=1, le=100)


class VenueOut(VenueBase):
    id: UUID

    class Config:
        from_attributes = True
