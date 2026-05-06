from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.redis import get_redis
from app.schemas.seat import SeatLockResponse, SeatWithZone
from app.services.queue_service import QueueService
from app.services.seat_service import (
    SEAT_LOCK_TTL_SECONDS,
    SeatService,
    list_seats_for_event,
)

router = APIRouter(tags=["seats"])


@router.get("/api/events/{event_id}/seats", response_model=list[SeatWithZone])
async def list_seats(event_id: UUID, db: AsyncSession = Depends(get_db)):
    seats = await list_seats_for_event(db, event_id)
    return [
        SeatWithZone(
            id=s.id,
            event_id=s.event_id,
            zone_id=s.zone_id,
            zone_name=s.zone.name if s.zone else None,
            zone_color=s.zone.color if s.zone else None,
            price=s.zone.price if s.zone else None,
            row_number=s.row_number,
            seat_number=s.seat_number,
            status=s.status,
            locked_by=s.locked_by,
            locked_at=s.locked_at,
        )
        for s in seats
    ]


@router.post(
    "/api/seats/{seat_id}/lock",
    response_model=SeatLockResponse,
    status_code=status.HTTP_200_OK,
)
async def lock_seat(
    seat_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    # ── Queue guard: if queue is active, user must be in the granted set ──
    # We need the event_id to check. Load the seat first for the FK.
    from sqlalchemy import select
    from app.models.seat import Seat

    result = await db.execute(select(Seat.event_id).where(Seat.id == seat_id))
    row = result.one_or_none()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Seat not found")
    event_id = row[0]

    queue_svc = QueueService(redis)
    if await queue_svc.is_queue_active(event_id):
        if not await queue_svc.is_user_granted(event_id, user.id):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                "You must wait in the queue before selecting seats",
            )

    seat = await SeatService(db, redis).lock(seat_id, user.id)
    return SeatLockResponse(
        seat_id=seat.id,
        status=seat.status,
        expires_in=SEAT_LOCK_TTL_SECONDS,
        locked_at=seat.locked_at,
    )


@router.post(
    "/api/seats/{seat_id}/unlock",
    response_model=SeatLockResponse,
)
async def unlock_seat(
    seat_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    seat = await SeatService(db, redis).unlock(seat_id, user.id)
    return SeatLockResponse(seat_id=seat.id, status=seat.status, expires_in=0)
