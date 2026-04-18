from uuid import UUID

from fastapi import APIRouter, Depends, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.redis import get_redis
from app.schemas.booking import BookingCreate, BookingOut
from app.services.booking_service import BookingService
from app.services.payment_service import PaymentService

router = APIRouter(prefix="/api/bookings", tags=["bookings"])


@router.post("", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
async def create_booking(
    payload: BookingCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await BookingService(db).create(
        user_id=user.id, event_id=payload.event_id, seat_ids=payload.seat_ids
    )


@router.get("/my", response_model=list[BookingOut])
async def list_my_bookings(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await BookingService(db).list_for_user(user.id)


@router.get("/{booking_id}", response_model=BookingOut)
async def get_booking(
    booking_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await BookingService(db).get_for_user(booking_id, user.id)


@router.post("/{booking_id}/pay", response_model=BookingOut)
async def pay_booking(
    booking_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    return await PaymentService(db, redis).simulate_payment(booking_id, user.id)


@router.post("/{booking_id}/cancel", response_model=BookingOut)
async def cancel_booking(
    booking_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    return await BookingService(db).cancel(booking_id, user.id, redis)
