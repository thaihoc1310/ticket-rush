import json
import logging
from uuid import UUID

from fastapi import HTTPException, status
from redis.asyncio import Redis
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.models.seat import Seat
from app.models.zone import Zone
from app.schemas.zone import ZoneCreate, ZoneUpdate
from app.utils.enums import SeatStatus

log = logging.getLogger(__name__)


class ZoneService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _get_event(self, event_id: UUID) -> Event:
        event = await self.db.get(Event, event_id)
        if event is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
        return event

    async def list_for_event(self, event_id: UUID) -> list[tuple[Zone, int]]:
        await self._get_event(event_id)
        stmt = (
            select(Zone, func.count(Seat.id))
            .outerjoin(Seat, Seat.zone_id == Zone.id)
            .where(Zone.event_id == event_id)
            .group_by(Zone.id)
            .order_by(Zone.name)
        )
        result = await self.db.execute(stmt)
        return [(zone, count) for zone, count in result.all()]

    async def get(self, zone_id: UUID) -> Zone:
        zone = await self.db.get(Zone, zone_id)
        if zone is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Zone not found")
        return zone

    async def create(self, event_id: UUID, data: ZoneCreate) -> Zone:
        await self._get_event(event_id)
        zone = Zone(event_id=event_id, **data.model_dump())
        self.db.add(zone)
        await self.db.commit()
        await self.db.refresh(zone)
        return zone

    async def update(self, zone_id: UUID, data: ZoneUpdate) -> Zone:
        zone = await self.get(zone_id)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(zone, field, value)
        await self.db.commit()
        await self.db.refresh(zone)
        return zone

    async def delete(self, zone_id: UUID) -> None:
        zone = await self.get(zone_id)
        # Unassign any seats pointing at this zone.
        await self.db.execute(
            update(Seat).where(Seat.zone_id == zone_id).values(zone_id=None)
        )
        await self.db.delete(zone)
        await self.db.commit()

    async def bulk_assign_seats(
        self,
        *,
        event_id: UUID,
        seat_ids: list[UUID],
        zone_id: UUID | None,
        redis: Redis,
    ) -> int:
        event = await self._get_event(event_id)

        if zone_id is not None:
            zone = await self.db.get(Zone, zone_id)
            if zone is None or zone.event_id != event_id:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    "Zone does not belong to this event",
                )

        # Only touch AVAILABLE seats in this event (don't disrupt locked/sold).
        stmt = select(Seat).where(
            Seat.id.in_(seat_ids),
            Seat.event_id == event_id,
            Seat.status == SeatStatus.AVAILABLE,
        )
        seats = list((await self.db.execute(stmt)).scalars().all())
        if not seats:
            return 0

        for seat in seats:
            seat.zone_id = zone_id
        await self.db.commit()

        # Broadcast zone changes so open canvases refresh.
        channel = f"event:{event.id}:seats"
        for seat in seats:
            payload = {
                "seat_id": str(seat.id),
                "zone_id": str(seat.zone_id) if seat.zone_id else None,
                "row_number": seat.row_number,
                "seat_number": seat.seat_number,
                "status": seat.status.value,
                "locked_by": None,
            }
            try:
                await redis.publish(channel, json.dumps(payload))
            except Exception:  # noqa: BLE001
                log.exception("Failed to publish zone assignment update")

        return len(seats)
