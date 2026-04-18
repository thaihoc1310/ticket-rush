"""Seed rich demo data for the admin dashboard.

Creates:
  - 1 admin + N customers with varied ages/genders
  - 2 venues
  - 3 events (mix of upcoming + past) with 8×12 master grids
  - Multiple zones per event, with seats assigned
  - CONFIRMED bookings spread across the last 30 days, with payments

Usage:
    uv run python -m scripts.seed_demo
"""

import asyncio
import random
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import delete

from app.database import async_session_maker
from app.models.booking import Booking, BookingItem
from app.models.event import Event
from app.models.payment import Payment
from app.models.seat import Seat
from app.models.ticket import Ticket
from app.models.user import User
from app.models.venue import Venue
from app.models.zone import Zone
from app.services.ticket_service import ticket_payload
from app.utils.enums import (
    BookingStatus,
    EventStatus,
    Gender,
    PaymentStatus,
    Role,
    SeatStatus,
    TicketStatus,
)
from app.utils.security import hash_password

random.seed(42)

CUSTOMERS = [
    ("alice@example.com", "Alice Nguyen", date(2001, 4, 12), Gender.FEMALE),
    ("bob@example.com", "Bob Tran", date(1993, 8, 3), Gender.MALE),
    ("carol@example.com", "Carol Pham", date(1987, 2, 21), Gender.FEMALE),
    ("david@example.com", "David Le", date(1978, 11, 5), Gender.MALE),
    ("emma@example.com", "Emma Vu", date(2005, 6, 17), Gender.FEMALE),
    ("finn@example.com", "Finn Hoang", date(1965, 1, 30), Gender.MALE),
    ("grace@example.com", "Grace Bui", date(1995, 7, 22), Gender.FEMALE),
    ("hao@example.com", "Hao Do", date(1982, 9, 9), Gender.OTHER),
    ("ivy@example.com", "Ivy Ly", date(2000, 12, 25), Gender.FEMALE),
    ("jack@example.com", "Jack Nguyen", date(1970, 3, 14), Gender.MALE),
]

PASSWORD = "password123"


async def clear_existing_demo(db) -> None:
    """Clear everything except admin users so the seed is idempotent."""
    await db.execute(delete(Ticket))
    await db.execute(delete(BookingItem))
    await db.execute(delete(Payment))
    await db.execute(delete(Booking))
    await db.execute(delete(Seat))
    await db.execute(delete(Zone))
    await db.execute(delete(Event))
    await db.execute(delete(Venue))
    await db.execute(delete(User).where(User.role != Role.ADMIN))
    await db.commit()


async def create_users(db) -> list[User]:
    users = []
    for email, full_name, dob, gender in CUSTOMERS:
        u = User(
            email=email,
            password_hash=hash_password(PASSWORD),
            full_name=full_name,
            date_of_birth=dob,
            gender=gender,
            role=Role.CUSTOMER,
        )
        db.add(u)
        users.append(u)
    await db.commit()
    for u in users:
        await db.refresh(u)
    return users


async def create_venues(db) -> list[Venue]:
    venues = [
        Venue(name="Grand Arena", address="1 Main St", city="Hanoi", capacity=2000),
        Venue(name="Skyline Hall", address="10 River Rd", city="Ho Chi Minh City", capacity=1200),
    ]
    db.add_all(venues)
    await db.commit()
    for v in venues:
        await db.refresh(v)
    return venues


ZONE_PRESETS = [
    ("VIP", Decimal("200.00"), "#ef4444"),
    ("Premium", Decimal("120.00"), "#8b5cf6"),
    ("Standard", Decimal("60.00"), "#22c55e"),
]


async def create_event_with_layout(
    db,
    *,
    title: str,
    venue: Venue,
    event_date: datetime,
    grid_rows: int,
    grid_cols: int,
    status: EventStatus,
) -> tuple[Event, list[Zone], list[Seat]]:
    event = Event(
        venue_id=venue.id,
        title=title,
        description=f"{title} at {venue.name}.",
        event_date=event_date,
        status=status,
        grid_rows=grid_rows,
        grid_cols=grid_cols,
    )
    db.add(event)
    await db.flush()

    seats: list[Seat] = []
    for r in range(1, grid_rows + 1):
        for c in range(1, grid_cols + 1):
            seats.append(
                Seat(
                    event_id=event.id,
                    zone_id=None,
                    row_number=r,
                    seat_number=c,
                    status=SeatStatus.AVAILABLE,
                )
            )
    db.add_all(seats)
    await db.flush()

    zones = [
        Zone(event_id=event.id, name=n, price=p, color=c)
        for (n, p, c) in ZONE_PRESETS
    ]
    db.add_all(zones)
    await db.flush()

    # Assign rows 1-2 to VIP, 3-5 to Premium, 6+ to Standard
    for seat in seats:
        if seat.row_number <= 2:
            seat.zone_id = zones[0].id
        elif seat.row_number <= 5:
            seat.zone_id = zones[1].id
        else:
            seat.zone_id = zones[2].id
    await db.commit()
    await db.refresh(event)
    for z in zones:
        await db.refresh(z)
    return event, zones, seats


async def create_confirmed_booking(
    db, *, user: User, event: Event, seats: list[Seat], paid_at: datetime
) -> None:
    total = sum((s.zone.price for s in seats if s.zone), Decimal(0))
    booking = Booking(
        user_id=user.id,
        event_id=event.id,
        total_amount=total,
        status=BookingStatus.CONFIRMED,
    )
    db.add(booking)
    await db.flush()

    # Backdate created_at so the dashboard revenue series shows spread.
    booking.created_at = paid_at
    booking.updated_at = paid_at

    for s in seats:
        s.status = SeatStatus.SOLD
        s.locked_by = None
        s.locked_at = None
        item = BookingItem(
            booking_id=booking.id,
            seat_id=s.id,
            price=s.zone.price if s.zone else Decimal(0),
        )
        db.add(item)
        await db.flush()

        ticket = Ticket(
            id=uuid4(),
            booking_item_id=item.id,
            qr_data="",
            status=TicketStatus.VALID,
            issued_at=paid_at,
        )
        db.add(ticket)
        await db.flush()
        ticket.qr_data = ticket_payload(ticket)

    payment = Payment(
        booking_id=booking.id,
        amount=total,
        method="simulated",
        status=PaymentStatus.COMPLETED,
        paid_at=paid_at,
    )
    db.add(payment)
    await db.flush()
    payment.created_at = paid_at
    payment.updated_at = paid_at
    await db.commit()


async def main() -> None:
    async with async_session_maker() as db:
        await clear_existing_demo(db)

        users = await create_users(db)
        venues = await create_venues(db)

        now = datetime.now(UTC)
        # Mix of upcoming + recently-past events
        events_spec = [
            ("Summer Music Fest", venues[0], now + timedelta(days=21), 8, 12, EventStatus.PUBLISHED),
            ("Indie Night", venues[1], now + timedelta(days=7), 6, 10, EventStatus.PUBLISHED),
            ("Retro Cinema", venues[0], now - timedelta(days=14), 8, 12, EventStatus.ENDED),
        ]

        events_with_layout = []
        for title, venue, ev_date, rows, cols, status in events_spec:
            tpl = await create_event_with_layout(
                db,
                title=title,
                venue=venue,
                event_date=ev_date,
                grid_rows=rows,
                grid_cols=cols,
                status=status,
            )
            events_with_layout.append(tpl)

        # Generate confirmed bookings across the last 30 days.
        print("Creating demo bookings…")
        booking_count = 0
        for i in range(60):
            user = random.choice(users)
            event, _zones, seats = random.choice(events_with_layout)
            # Pick 1-4 free contiguous seats in the same row
            available = [
                s for s in seats if s.status == SeatStatus.AVAILABLE and s.zone_id
            ]
            if not available:
                continue
            group_size = random.randint(1, 4)
            # Pick a row with enough free seats
            by_row: dict[int, list[Seat]] = {}
            for s in available:
                by_row.setdefault(s.row_number, []).append(s)
            candidate_rows = [r for r, lst in by_row.items() if len(lst) >= group_size]
            if not candidate_rows:
                continue
            row = random.choice(candidate_rows)
            row_seats = sorted(by_row[row], key=lambda s: s.seat_number)
            start = random.randint(0, len(row_seats) - group_size)
            picked = row_seats[start : start + group_size]

            days_ago = random.randint(0, 29)
            paid_at = now - timedelta(
                days=days_ago,
                hours=random.randint(0, 23),
                minutes=random.randint(0, 59),
            )
            await create_confirmed_booking(
                db, user=user, event=event, seats=picked, paid_at=paid_at
            )
            booking_count += 1

        print(f"Seeded {len(users)} users, {len(venues)} venues, "
              f"{len(events_with_layout)} events, {booking_count} confirmed bookings.")
        print(f"Customer login example: {users[0].email} / {PASSWORD}")


if __name__ == "__main__":
    asyncio.run(main())
