from datetime import datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.event import Event
from app.models.seat import Seat
from app.models.venue import Venue
from app.schemas.event import EventCreate, EventUpdate
from app.utils.enums import EventStatus, SeatStatus


class EventService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(
        self,
        *,
        search: str | None = None,
        city: str | None = None,
        status_filter: EventStatus | None = None,
        upcoming_only: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Event]:
        stmt = select(Event).options(selectinload(Event.venue))

        if search:
            like = f"%{search.lower()}%"
            stmt = stmt.where(
                or_(
                    Event.title.ilike(like),
                    Event.description.ilike(like),
                )
            )
        if city:
            stmt = stmt.join(Event.venue).where(Venue.city.ilike(f"%{city}%"))
        if status_filter:
            stmt = stmt.where(Event.status == status_filter)
        if upcoming_only:
            stmt = stmt.where(Event.event_date >= datetime.utcnow())

        stmt = stmt.order_by(Event.event_date).limit(limit).offset(offset)
        result = await self.db.execute(stmt)
        return list(result.scalars().unique().all())

    async def get(self, event_id: UUID) -> Event:
        stmt = (
            select(Event)
            .where(Event.id == event_id)
            .options(selectinload(Event.venue))
        )
        result = await self.db.execute(stmt)
        event = result.scalar_one_or_none()
        if event is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
        return event

    async def _ensure_venue(self, venue_id: UUID) -> None:
        venue = await self.db.get(Venue, venue_id)
        if venue is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Venue does not exist")

    async def create(self, data: EventCreate) -> Event:
        await self._ensure_venue(data.venue_id)
        event = Event(**data.model_dump())
        self.db.add(event)
        await self.db.flush()

        # Auto-generate seats for every position in the master grid.
        # Seats start with zone_id=NULL; admin assigns zones via bulk endpoint.
        seats = [
            Seat(
                event_id=event.id,
                zone_id=None,
                row_number=row,
                seat_number=col,
                status=SeatStatus.AVAILABLE,
            )
            for row in range(1, event.grid_rows + 1)
            for col in range(1, event.grid_cols + 1)
        ]
        self.db.add_all(seats)
        await self.db.commit()
        return await self.get(event.id)

    async def update(self, event_id: UUID, data: EventUpdate) -> Event:
        event = await self.get(event_id)
        payload = data.model_dump(exclude_unset=True)
        if "venue_id" in payload and payload["venue_id"] is not None:
            await self._ensure_venue(payload["venue_id"])
        for field, value in payload.items():
            setattr(event, field, value)
        await self.db.commit()
        return await self.get(event_id)

    async def delete(self, event_id: UUID) -> None:
        event = await self.get(event_id)
        await self.db.delete(event)
        await self.db.commit()
