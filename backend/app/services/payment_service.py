import json
import logging
from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.booking import Booking, BookingItem
from app.models.event import Event
from app.models.payment import Payment
from app.models.seat import Seat
from app.schemas.booking import BookingOut
from app.services.booking_service import _to_booking_out
from app.services.ticket_service import TicketService
from app.utils.enums import BookingStatus, PaymentStatus, SeatStatus

log = logging.getLogger(__name__)


class PaymentService:
    def __init__(self, db: AsyncSession, redis: Redis):
        self.db = db
        self.redis = redis

    async def simulate_payment(self, booking_id: UUID, user_id: UUID) -> BookingOut:
        stmt = (
            select(Booking)
            .where(Booking.id == booking_id)
            .options(
                selectinload(Booking.items)
                .selectinload(BookingItem.seat)
                .selectinload(Seat.zone)
            )
        )
        booking = (await self.db.execute(stmt)).scalar_one_or_none()
        if booking is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Booking not found")
        if booking.user_id != user_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your booking")
        if booking.status != BookingStatus.PENDING:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Cannot pay a booking in status {booking.status.value}",
            )

        # All seats must still be held by this user.
        for item in booking.items:
            seat = item.seat
            if seat.status != SeatStatus.LOCKED or seat.locked_by != user_id:
                raise HTTPException(
                    status.HTTP_409_CONFLICT,
                    "One or more seats are no longer held",
                )

        now = datetime.now(UTC)
        payment = Payment(
            booking_id=booking.id,
            amount=booking.total_amount,
            method="simulated",
            status=PaymentStatus.COMPLETED,
            paid_at=now,
        )
        self.db.add(payment)

        booking.status = BookingStatus.CONFIRMED
        event_id = booking.event_id

        sold_seat_payloads: list[dict] = []
        for item in booking.items:
            seat = item.seat
            seat.status = SeatStatus.SOLD
            seat.locked_by = None
            seat.locked_at = None
            sold_seat_payloads.append({
                "seat_id": str(seat.id),
                "zone_id": str(seat.zone_id),
                "row_number": seat.row_number,
                "seat_number": seat.seat_number,
                "status": SeatStatus.SOLD.value,
                "locked_by": None,
            })

        await self.db.commit()

        # Issue tickets (generates QR payload = "TICKETRUSH:<ticket_id>").
        await TicketService(self.db).issue_for_booking(booking.id)

        # Broadcast seat updates across all instances.
        channel = f"event:{event_id}:seats"
        for payload in sold_seat_payloads:
            try:
                await self.redis.publish(channel, json.dumps(payload))
            except Exception:  # noqa: BLE001
                log.exception("Failed to publish sold-seat update")

        event = await self.db.get(Event, booking.event_id)
        await self.db.refresh(booking)
        return _to_booking_out(booking, event)  # type: ignore[arg-type]
