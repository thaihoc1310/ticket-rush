import json
import logging
from datetime import UTC, datetime, timedelta

from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import async_session_maker
from app.models.booking import Booking, BookingItem
from app.models.seat import Seat
from app.redis import get_redis
from app.services.seat_service import LOCK_TTL_SECONDS
from app.utils.enums import BookingStatus, SeatStatus

log = logging.getLogger(__name__)

SWEEP_LOCK_KEY = "lock:sweep_seats"
SWEEP_LOCK_TTL = 14  # seconds — must be < interval (15s) for next tick to retry


async def _publish_release(redis: Redis, event_id, seat: Seat) -> None:
    payload = {
        "seat_id": str(seat.id),
        "zone_id": str(seat.zone_id),
        "row_number": seat.row_number,
        "seat_number": seat.seat_number,
        "status": SeatStatus.AVAILABLE.value,
        "locked_by": None,
    }
    try:
        await redis.publish(f"event:{event_id}:seats", json.dumps(payload))
    except Exception:  # noqa: BLE001
        log.exception("Failed to publish seat release")


async def sweep_expired_seats() -> None:
    """Runs every 15s. Releases seats whose lock has exceeded LOCK_TTL_SECONDS."""
    redis = await get_redis()
    acquired = await redis.set(SWEEP_LOCK_KEY, "1", nx=True, ex=SWEEP_LOCK_TTL)
    if not acquired:
        return

    try:
        async with async_session_maker() as db:
            cutoff = datetime.now(UTC) - timedelta(seconds=LOCK_TTL_SECONDS)
            stmt = (
                select(Seat)
                .where(Seat.status == SeatStatus.LOCKED)
                .where(Seat.locked_at < cutoff)
                .options(selectinload(Seat.zone))
            )
            expired = list((await db.execute(stmt)).scalars().all())
            if not expired:
                return

            released: list[Seat] = []
            for seat in expired:
                seat.status = SeatStatus.AVAILABLE
                seat.locked_by = None
                seat.locked_at = None
                released.append(seat)

            # Mark associated pending bookings as EXPIRED when all their seats are released.
            seat_ids = [s.id for s in released]
            b_stmt = (
                select(Booking)
                .join(BookingItem, BookingItem.booking_id == Booking.id)
                .where(BookingItem.seat_id.in_(seat_ids))
                .where(Booking.status == BookingStatus.PENDING)
                .distinct()
            )
            for booking in (await db.execute(b_stmt)).scalars().all():
                booking.status = BookingStatus.EXPIRED

            await db.commit()

            for seat in released:
                await _publish_release(redis, seat.zone.event_id, seat)

            log.info("Released %d expired seat locks", len(released))
    finally:
        try:
            await redis.delete(SWEEP_LOCK_KEY)
        except Exception:  # noqa: BLE001
            pass
