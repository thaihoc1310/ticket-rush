import base64
import io
from uuid import UUID

import qrcode
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.booking import Booking, BookingItem
from app.models.event import Event
from app.models.seat import Seat
from app.models.ticket import Ticket
from app.schemas.booking import TicketOut


def _render_qr(payload: str) -> str:
    img = qrcode.make(payload)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"


def ticket_payload(ticket: Ticket) -> str:
    return f"TICKETRUSH:{ticket.id}"


def _to_ticket_out(ticket: Ticket, item: BookingItem, event: Event) -> TicketOut:
    return TicketOut(
        id=ticket.id,
        booking_item_id=ticket.booking_item_id,
        qr_data=ticket.qr_data,
        qr_image=_render_qr(ticket.qr_data),
        status=ticket.status,
        issued_at=ticket.issued_at,
        event_id=event.id,
        event_title=event.title,
        event_status=event.status,
        event_date=event.event_date,
        venue_name=event.venue.name,
        venue_address=event.venue.address,
        price=item.price,
        zone_name=item.seat.zone.name if item.seat and item.seat.zone else "",
        row_number=item.seat.row_number if item.seat else 0,
        seat_number=item.seat.seat_number if item.seat else 0,
    )


class TicketService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def issue_for_booking(self, booking_id: UUID) -> list[Ticket]:
        stmt = (
            select(Booking)
            .where(Booking.id == booking_id)
            .options(selectinload(Booking.items))
        )
        booking = (await self.db.execute(stmt)).scalar_one()

        existing = {t.booking_item_id for t in await self._existing_tickets(booking_id)}
        new_tickets: list[Ticket] = []
        for item in booking.items:
            if item.id in existing:
                continue
            ticket = Ticket(booking_item_id=item.id, qr_data="")
            self.db.add(ticket)
            new_tickets.append(ticket)
        await self.db.flush()

        for ticket in new_tickets:
            ticket.qr_data = ticket_payload(ticket)
        await self.db.commit()
        return new_tickets

    async def _existing_tickets(self, booking_id: UUID) -> list[Ticket]:
        stmt = (
            select(Ticket)
            .join(BookingItem, Ticket.booking_item_id == BookingItem.id)
            .where(BookingItem.booking_id == booking_id)
        )
        return list((await self.db.execute(stmt)).scalars().all())

    async def list_for_user(self, user_id: UUID) -> list[TicketOut]:
        stmt = (
            select(Ticket)
            .join(BookingItem, Ticket.booking_item_id == BookingItem.id)
            .join(Booking, BookingItem.booking_id == Booking.id)
            .where(Booking.user_id == user_id)
            .options(
                selectinload(Ticket.booking_item)
                .selectinload(BookingItem.seat)
                .selectinload(Seat.zone)
            )
            .order_by(Ticket.issued_at.desc())
        )
        rows = list((await self.db.execute(stmt)).scalars().all())
        if not rows:
            return []
        booking_ids = {t.booking_item.booking_id for t in rows}
        b_stmt = select(Booking).where(Booking.id.in_(booking_ids))
        bookings = {b.id: b for b in (await self.db.execute(b_stmt)).scalars().all()}
        e_ids = {b.event_id for b in bookings.values()}
        e_stmt = select(Event).where(Event.id.in_(e_ids))
        events = {e.id: e for e in (await self.db.execute(e_stmt)).scalars().all()}

        out: list[TicketOut] = []
        for ticket in rows:
            booking = bookings.get(ticket.booking_item.booking_id)
            event = events.get(booking.event_id) if booking else None
            if not event:
                continue
            out.append(_to_ticket_out(ticket, ticket.booking_item, event))
        return out

    async def get_for_user(self, ticket_id: UUID, user_id: UUID) -> TicketOut:
        stmt = (
            select(Ticket)
            .where(Ticket.id == ticket_id)
            .options(
                selectinload(Ticket.booking_item)
                .selectinload(BookingItem.seat)
                .selectinload(Seat.zone)
            )
        )
        ticket = (await self.db.execute(stmt)).scalar_one_or_none()
        if ticket is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Ticket not found")
        booking = await self.db.get(Booking, ticket.booking_item.booking_id)
        if booking is None or booking.user_id != user_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your ticket")
        event = await self.db.get(Event, booking.event_id)
        if event is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
        return _to_ticket_out(ticket, ticket.booking_item, event)
