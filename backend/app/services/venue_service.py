from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.venue import Venue
from app.schemas.venue import VenueCreate, VenueUpdate


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
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(venue, field, value)
        await self.db.commit()
        await self.db.refresh(venue)
        return venue

    async def delete(self, venue_id: UUID) -> None:
        venue = await self.get(venue_id)
        await self.db.delete(venue)
        await self.db.commit()
