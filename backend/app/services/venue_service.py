from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.models.venue import Venue
from app.schemas.venue import VenueCreate, VenueUpdate
from app.services.seat_layout_service import sync_event_seats_to_layout


class VenueService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self) -> list[Venue]:
        result = await self.db.execute(select(Venue).order_by(Venue.name))
        return list(result.scalars().all())

    async def get(self, venue_id: UUID) -> Venue:
        venue = await self.db.get(Venue, venue_id)
        if venue is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Venue not found")
        return venue

    async def create(self, data: VenueCreate) -> Venue:
        venue = Venue(**data.model_dump())
        self.db.add(venue)
        await self.db.commit()
        await self.db.refresh(venue)
        return venue

    async def update(self, venue_id: UUID, data: VenueUpdate) -> Venue:
        venue = await self.get(venue_id)
        payload = data.model_dump(exclude_unset=True)
        if payload.get("grid_rows") is None and "grid_rows" in payload:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Grid rows cannot be empty")
        if payload.get("grid_cols") is None and "grid_cols" in payload:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Grid cols cannot be empty")

        new_rows = payload.get("grid_rows", venue.grid_rows)
        new_cols = payload.get("grid_cols", venue.grid_cols)
        layout_changed = new_rows != venue.grid_rows or new_cols != venue.grid_cols

        if layout_changed:
            result = await self.db.execute(
                select(Event.id).where(Event.venue_id == venue_id)
            )
            event_ids = list(result.scalars().all())
            for event_id in event_ids:
                await sync_event_seats_to_layout(
                    self.db,
                    event_id=event_id,
                    grid_rows=new_rows,
                    grid_cols=new_cols,
                )

        for field, value in payload.items():
            setattr(venue, field, value)
        await self.db.commit()
        await self.db.refresh(venue)
        return venue

    async def delete(self, venue_id: UUID) -> None:
        venue = await self.get(venue_id)
        await self.db.delete(venue)
        await self.db.commit()
