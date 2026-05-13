import json
import logging
from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.event import Event
from app.models.seat import Seat
from app.models.ticket import Ticket
from app.models.booking import Booking, BookingItem
from app.utils.enums import SeatStatus, TicketStatus

log = logging.getLogger(__name__)

# Seat selection phase: time user has to decide & proceed to checkout.
SEAT_LOCK_TTL_SECONDS = 60  # 1 min for demo (production: 10 * 60)
# Booking/checkout phase: time user has to complete payment after creating booking.
BOOKING_TTL_SECONDS = 60  # 1 min for demo (production: 10 * 60)
# Backward-compat alias used by booking_service / scheduler.
LOCK_TTL_SECONDS = SEAT_LOCK_TTL_SECONDS
# Redis micro-lock for the lock operation itself (filters 99.9% of contention).
REDIS_GUARD_TTL = 5


def _seat_channel(event_id: UUID) -> str:
    return f"event:{event_id}:seats"


def _guard_key(seat_id: UUID) -> str:
    return f"seat:{seat_id}:lock"


async def _publish_update(redis: Redis, event_id: UUID, seat: Seat, user_id: UUID | None) -> None:
    payload = {
        "seat_id": str(seat.id),
        "zone_id": str(seat.zone_id),
        "row_number": seat.row_number,
        "seat_number": seat.seat_number,
        "status": seat.status.value,
        "locked_by": str(user_id) if user_id else None,
    }
    try:
        await redis.publish(_seat_channel(event_id), json.dumps(payload))
    except Exception:  # noqa: BLE001
        log.exception("Failed to publish seat update to Redis")


async def list_seats_for_event(db: AsyncSession, event_id: UUID) -> list[Seat]:
    stmt = (
        select(Seat)
        .where(Seat.event_id == event_id)
        .options(selectinload(Seat.zone))
        .order_by(Seat.row_number, Seat.seat_number)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


class SeatService:
    def __init__(self, db: AsyncSession, redis: Redis):
        self.db = db
        self.redis = redis

    async def _load_seat_with_event(self, seat_id: UUID) -> tuple[Seat, UUID]:
        stmt = (
            select(Seat)
            .where(Seat.id == seat_id)
            .options(selectinload(Seat.zone))
        )
        result = await self.db.execute(stmt)
        seat = result.scalar_one_or_none()
        if seat is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Seat not found")
        return seat, seat.event_id

    async def lock(self, seat_id: UUID, user_id: UUID) -> Seat:
        # Layer 1: Redis distributed lock (fast filter, microseconds).
        guard = _guard_key(seat_id)
        acquired = await self.redis.set(guard, str(user_id), nx=True, ex=REDIS_GUARD_TTL)
        if not acquired:
            raise HTTPException(status.HTTP_409_CONFLICT, "Seat is being contested")

        try:
            # Layer 2: Postgres FOR UPDATE NOWAIT (data consistency guarantee).
            try:
                result = await self.db.execute(
                    select(Seat)
                    .where(Seat.id == seat_id)
                    .with_for_update(nowait=True)
                )
            except DBAPIError as exc:
                await self.db.rollback()
                if "LockNotAvailable" in str(exc.__cause__) or "could not obtain lock" in str(exc):
                    raise HTTPException(
                        status.HTTP_409_CONFLICT, "Seat is being contested"
                    ) from exc
                raise

            seat = result.scalar_one_or_none()
            if seat is None:
                await self.db.rollback()
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Seat not found")
            if seat.zone_id is None:
                await self.db.rollback()
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    "This seat is not assigned to a zone and cannot be booked",
                )
            if seat.status != SeatStatus.AVAILABLE:
                await self.db.rollback()
                raise HTTPException(status.HTTP_409_CONFLICT, "Seat unavailable")

            # Check if user has reached the maximum ticket limit (8)
            from sqlalchemy import func
            # 1. Count seats currently locked by user for this event
            locked_stmt = select(func.count()).select_from(Seat).where(
                Seat.event_id == seat.event_id,
                Seat.status == SeatStatus.LOCKED,
                Seat.locked_by == user_id,
            )
            locked_count = (await self.db.execute(locked_stmt)).scalar_one()

            # 2. Count valid/used tickets owned by user for this event
            ticket_stmt = (
                select(func.count())
                .select_from(Ticket)
                .join(BookingItem, Ticket.booking_item_id == BookingItem.id)
                .join(Booking, BookingItem.booking_id == Booking.id)
                .where(
                    Booking.event_id == seat.event_id,
                    Booking.user_id == user_id,
                    Ticket.status.in_([TicketStatus.VALID, TicketStatus.USED])
                )
            )
            ticket_count = (await self.db.execute(ticket_stmt)).scalar_one()

            # Fetch event to get the configured max tickets limit
            event = await self.db.get(Event, seat.event_id)
            max_tickets = event.max_tickets_per_user if event else 8

            if locked_count + ticket_count >= max_tickets:
                await self.db.rollback()
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    f"LIMIT_REACHED: You can only own a maximum of {max_tickets} tickets for this event (including currently selected seats and purchased tickets).",
                )

            seat.status = SeatStatus.LOCKED
            seat.locked_by = user_id
            seat.locked_at = datetime.now(UTC)
            await self.db.commit()

            reloaded, event_id = await self._load_seat_with_event(seat_id)
            await _publish_update(self.redis, event_id, reloaded, user_id)
            return reloaded
        finally:
            await self.redis.delete(guard)

    async def unlock(self, seat_id: UUID, user_id: UUID) -> Seat:
        result = await self.db.execute(
            select(Seat).where(Seat.id == seat_id).with_for_update()
        )
        seat = result.scalar_one_or_none()
        if seat is None:
            await self.db.rollback()
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Seat not found")
        if seat.status != SeatStatus.LOCKED:
            await self.db.rollback()
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Seat is not locked")
        if seat.locked_by != user_id:
            await self.db.rollback()
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "Seat is locked by another user"
            )
        seat.status = SeatStatus.AVAILABLE
        seat.locked_by = None
        seat.locked_at = None
        await self.db.commit()

        reloaded, event_id = await self._load_seat_with_event(seat_id)
        await _publish_update(self.redis, event_id, reloaded, None)
        return reloaded
