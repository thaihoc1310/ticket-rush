from uuid import UUID

from fastapi import APIRouter, Depends, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.redis import get_redis
from app.schemas.seat import SeatLockResponse, SeatWithZone
from app.services.seat_service import (
    LOCK_TTL_SECONDS,
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
    seat = await SeatService(db, redis).lock(seat_id, user.id)
    return SeatLockResponse(
        seat_id=seat.id, status=seat.status, expires_in=LOCK_TTL_SECONDS
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
