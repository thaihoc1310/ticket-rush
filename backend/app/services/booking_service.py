import json
import logging
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

log = logging.getLogger(__name__)

from app.models.booking import Booking, BookingItem
from app.models.event import Event
from app.models.seat import Seat
from app.schemas.booking import (
    BookingItemOut,
    BookingOut,
    PaymentOut,
)
from app.services.seat_service import BOOKING_TTL_SECONDS, LOCK_TTL_SECONDS
from app.utils.enums import BookingStatus, SeatStatus, TicketStatus
from app.models.ticket import Ticket


def _to_booking_out(booking: Booking, event: Event) -> BookingOut:
    items = [
        BookingItemOut(
            id=item.id,
            seat_id=item.seat_id,
            row_number=item.seat.row_number,
            seat_number=item.seat.seat_number,
            zone_name=item.seat.zone.name if item.seat.zone else "",
            price=item.price,
        )
        for item in booking.items
    ]
    payment = (
        PaymentOut(
            id=booking.payment.id,
            amount=booking.payment.amount,
            method=booking.payment.method,
            status=booking.payment.status,
            paid_at=booking.payment.paid_at,
        )
        if booking.payment
        else None
    )
    # Booking timer is based on booking.updated_at (reset each time user enters checkout).
    # This keeps locked_at as the original lock time for seat-selection countdowns.
    expires_at = booking.updated_at + timedelta(seconds=BOOKING_TTL_SECONDS)
    return BookingOut(
        id=booking.id,
        event_id=booking.event_id,
        event_title=event.title,
        event_date=event.event_date,
        status=booking.status,
        total_amount=booking.total_amount,
        created_at=booking.created_at,
        expires_at=expires_at,
        items=items,
        payment=payment,
    )


class BookingService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _load_booking(self, booking_id: UUID) -> tuple[Booking, Event]:
        stmt = (
            select(Booking)
            .where(Booking.id == booking_id)
            .options(
                selectinload(Booking.items)
                .selectinload(BookingItem.seat)
                .selectinload(Seat.zone)
            )
        )
        result = await self.db.execute(stmt)
        booking = result.scalar_one_or_none()
        if booking is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Booking not found")
        event = await self.db.get(Event, booking.event_id)
        if event is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
        return booking, event

    async def create(
        self, *, user_id: UUID, event_id: UUID, seat_ids: list[UUID]
    ) -> BookingOut:
        if len(set(seat_ids)) != len(seat_ids):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Duplicate seats")

        stmt = (
            select(Seat)
            .where(Seat.id.in_(seat_ids))
            .options(selectinload(Seat.zone))
        )
        result = await self.db.execute(stmt)
        seats = list(result.scalars().all())
        if len(seats) != len(seat_ids):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "One or more seats not found")

        for seat in seats:
            if seat.status != SeatStatus.LOCKED:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    f"Seat {seat.row_number}-{seat.seat_number} is not locked",
                )
            if seat.locked_by != user_id:
                raise HTTPException(
                    status.HTTP_403_FORBIDDEN,
                    "One or more seats are locked by another user",
                )
            if seat.event_id != event_id:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    "All seats must belong to the same event",
                )
            if seat.zone is None:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    "Seat is not assigned to a zone",
                )

        from sqlalchemy import func
        # Count existing valid/used tickets for this event
        ticket_stmt = (
            select(func.count())
            .select_from(Ticket)
            .join(BookingItem, Ticket.booking_item_id == BookingItem.id)
            .join(Booking, BookingItem.booking_id == Booking.id)
            .where(
                Booking.event_id == event_id,
                Booking.user_id == user_id,
                Ticket.status.in_([TicketStatus.VALID, TicketStatus.USED])
            )
        )
        ticket_count = (await self.db.execute(ticket_stmt)).scalar_one()

        event = await self.db.get(Event, event_id)
        max_tickets = event.max_tickets_per_user if event else 8

        if len(seat_ids) + ticket_count > max_tickets:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"LIMIT_REACHED: You can only own a maximum of {max_tickets} tickets for this event.",
            )

        # --- Safety net: clean up stale BookingItems for these seats ---
        # BookingItem.seat_id is UNIQUE. Normally, the frontend calls
        # dismiss() on unmount, so no stale items should exist. This is
        # a fallback for race conditions / crashed clients.
        from sqlalchemy import delete as sa_delete

        stale_stmt = (
            select(BookingItem)
            .where(BookingItem.seat_id.in_(seat_ids))
            .options(selectinload(BookingItem.booking))
        )
        stale_items = list((await self.db.execute(stale_stmt)).scalars().all())
        if stale_items:
            stale_booking_ids: set[UUID] = set()
            for item in stale_items:
                if not item.booking:
                    continue
                b = item.booking
                if b.status in (BookingStatus.EXPIRED, BookingStatus.CANCELLED):
                    stale_booking_ids.add(b.id)
                elif b.status == BookingStatus.PENDING and b.user_id == user_id:
                    # User's own stale pending booking (dismiss didn't complete).
                    stale_booking_ids.add(b.id)
                elif b.status in (BookingStatus.PENDING, BookingStatus.CONFIRMED):
                    raise HTTPException(
                        status.HTTP_409_CONFLICT,
                        "One or more seats are already booked",
                    )
            if stale_booking_ids:
                await self.db.execute(
                    sa_delete(BookingItem).where(BookingItem.booking_id.in_(stale_booking_ids))
                )
                await self.db.execute(
                    sa_delete(Booking).where(Booking.id.in_(stale_booking_ids))
                )
                await self.db.flush()

        total: Decimal = sum((s.zone.price for s in seats), Decimal(0))

        # Do NOT reset locked_at here — it must stay as the original lock time
        # so that seat-selection timers continue correctly on browser-back.
        # The booking timer uses booking.created_at instead.

        now_utc = datetime.now(UTC)
        booking = Booking(
            user_id=user_id,
            event_id=event_id,
            total_amount=total,
            status=BookingStatus.PENDING,
            created_at=now_utc,
            updated_at=now_utc,
        )
        self.db.add(booking)
        await self.db.flush()

        for seat in seats:
            self.db.add(
                BookingItem(
                    booking_id=booking.id,
                    seat_id=seat.id,
                    price=seat.zone.price,
                )
            )
        await self.db.commit()
        booking, event = await self._load_booking(booking.id)
        return _to_booking_out(booking, event)

    async def get_for_user(self, booking_id: UUID, user_id: UUID) -> BookingOut:
        booking, event = await self._load_booking(booking_id)
        if booking.user_id != user_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your booking")
        return _to_booking_out(booking, event)

    async def dismiss(self, booking_id: UUID, user_id: UUID) -> None:
        """Delete booking + items but keep seats LOCKED.

        Called when user navigates away from checkout (browser back).
        Seats remain locked with their original locked_at so the
        seat-selection timer can resume.
        """
        from sqlalchemy import delete as sa_delete

        booking, _ = await self._load_booking(booking_id)
        if booking.user_id != user_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your booking")
        if booking.status != BookingStatus.PENDING:
            return  # Nothing to dismiss.

        # Shift locked_at forward by the time the user spent on the checkout
        # page.  This implements pause/resume: if a seat had 10 s remaining
        # when the user entered checkout and they spent 20 s there, the seat
        # will still have 10 s remaining when they come back.
        #
        #   pause_duration  = now - booking.updated_at
        #   new_locked_at   = old_locked_at + pause_duration
        #   remaining       = TTL - (now - new_locked_at)   ← unchanged
        seat_ids = [item.seat_id for item in booking.items]
        if seat_ids:
            from sqlalchemy import update as sa_update

            pause_duration = datetime.now(UTC) - booking.updated_at
            await self.db.execute(
                sa_update(Seat)
                .where(Seat.id.in_(seat_ids))
                .where(Seat.status == SeatStatus.LOCKED)
                .values(locked_at=Seat.locked_at + pause_duration)
            )

        await self.db.execute(
            sa_delete(BookingItem).where(BookingItem.booking_id == booking.id)
        )
        await self.db.execute(
            sa_delete(Booking).where(Booking.id == booking.id)
        )
        await self.db.commit()

    async def cancel(
        self, booking_id: UUID, user_id: UUID, redis: Redis
    ) -> BookingOut:
        booking, event = await self._load_booking(booking_id)
        if booking.user_id != user_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your booking")
        if booking.status != BookingStatus.PENDING:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Cannot cancel booking in status {booking.status.value}",
            )

        released: list[tuple[UUID, int, int, UUID]] = []
        for item in booking.items:
            seat = item.seat
            if seat.status == SeatStatus.LOCKED and seat.locked_by == user_id:
                seat.status = SeatStatus.AVAILABLE
                seat.locked_by = None
                seat.locked_at = None
                released.append((seat.id, seat.row_number, seat.seat_number, seat.zone_id))

        booking.status = BookingStatus.CANCELLED
        await self.db.commit()

        channel = f"event:{booking.event_id}:seats"
        for seat_id, row, col, zone_id in released:
            payload = {
                "seat_id": str(seat_id),
                "zone_id": str(zone_id) if zone_id else None,
                "row_number": row,
                "seat_number": col,
                "status": SeatStatus.AVAILABLE.value,
                "locked_by": None,
            }
            try:
                await redis.publish(channel, json.dumps(payload))
            except Exception:  # noqa: BLE001
                log.exception("Failed to publish seat release on cancel")

        booking, event = await self._load_booking(booking_id)
        return _to_booking_out(booking, event)

    async def list_for_user(self, user_id: UUID) -> list[BookingOut]:
        stmt = (
            select(Booking)
            .where(Booking.user_id == user_id)
            .options(
                selectinload(Booking.items)
                .selectinload(BookingItem.seat)
                .selectinload(Seat.zone)
            )
            .order_by(Booking.created_at.desc())
        )
        result = await self.db.execute(stmt)
        bookings = list(result.scalars().all())

        event_ids = {b.event_id for b in bookings}
        events: dict[UUID, Event] = {}
        if event_ids:
            ev_res = await self.db.execute(select(Event).where(Event.id.in_(event_ids)))
            events = {e.id: e for e in ev_res.scalars().all()}

        return [
            _to_booking_out(b, events[b.event_id]) for b in bookings if b.event_id in events
        ]
