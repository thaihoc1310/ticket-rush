"""Seed rich demo data for the admin dashboard.

Creates:
  - 1 admin + N customers with varied ages/genders
  - 2 venues
  - 10 events (mix of upcoming + past, Apr–Jun 2026) with randomised grids
  - Multiple zones per event with prices spread $10–$200
  - CONFIRMED bookings (≤60 % capacity so seats always remain available)

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


def random_zone_presets() -> list[tuple[str, Decimal, str]]:
    """Generate randomised zone prices within $10–$200 per event."""
    std_price = Decimal(random.randint(10, 50))
    prem_price = Decimal(random.randint(60, 120))
    vip_price = Decimal(random.randint(130, 200))
    return [
        ("VIP", vip_price, "#ef4444"),
        ("Premium", prem_price, "#8b5cf6"),
        ("Standard", std_price, "#22c55e"),
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
    category: str | None = None,
) -> tuple[Event, list[Zone], list[Seat]]:
    event = Event(
        venue_id=venue.id,
        title=title,
        description=f"{title} at {venue.name}.",
        event_date=event_date,
        status=status,
        grid_rows=grid_rows,
        grid_cols=grid_cols,
        category=category,
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

    zone_presets = random_zone_presets()
    zones = [
        Zone(event_id=event.id, name=n, price=p, color=c)
        for (n, p, c) in zone_presets
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


# ── 10 diverse events (title, category) ─────────────────────────────
EVENT_CATALOGUE = [
    ("Summer Music Fest", "Festival"),
    ("Indie Night", "Concert"),
    ("Retro Cinema", "Workshop"),
    ("EDM Rave Night", "Concert"),
    ("Jazz Under the Stars", "Concert"),
    ("K-Pop Fan Meeting", "Festival"),
    ("Acoustic Sunset Session", "Concert"),
    ("Hip-Hop Block Party", "Festival"),
    ("Classical Gala", "Theater"),
    ("Rock the Arena", "Concert"),
]

MAX_BOOKING_RATIO = 0.6  # never fill more than 60 % of seats


def _random_event_date() -> datetime:
    """Return a random datetime between 1 Apr 2026 and 30 Jun 2026 (UTC)."""
    start = datetime(2026, 4, 1, tzinfo=UTC)
    end = datetime(2026, 6, 30, 23, 59, tzinfo=UTC)
    delta = end - start
    offset = timedelta(seconds=random.randint(0, int(delta.total_seconds())))
    return start + offset


async def main() -> None:
    async with async_session_maker() as db:
        await clear_existing_demo(db)

        users = await create_users(db)
        venues = await create_venues(db)

        now = datetime.now(UTC)

        # Build 10 events with random dates, grid sizes and auto-status
        events_spec = []
        for title, category in EVENT_CATALOGUE:
            ev_date = _random_event_date()
            status = EventStatus.ENDED if ev_date < now else EventStatus.PUBLISHED
            rows = random.randint(6, 10)
            cols = random.randint(10, 15)
            venue = random.choice(venues)
            events_spec.append((title, venue, ev_date, rows, cols, status, category))

        events_with_layout: list[tuple[Event, list[Zone], list[Seat]]] = []
        for title, venue, ev_date, rows, cols, status, category in events_spec:
            tpl = await create_event_with_layout(
                db,
                title=title,
                venue=venue,
                event_date=ev_date,
                grid_rows=rows,
                grid_cols=cols,
                status=status,
                category=category,
            )
            events_with_layout.append(tpl)

        # Generate confirmed bookings, capped at 60 % of each event's capacity.
        print("Creating demo bookings…")
        booking_count = 0
        sold_per_event: dict[str, int] = {}

        for _i in range(150):  # attempt up to 150 bookings across 10 events
            user = random.choice(users)
            event, _zones, seats = random.choice(events_with_layout)

            total_seats = len(seats)
            max_sold = int(total_seats * MAX_BOOKING_RATIO)
            already_sold = sold_per_event.get(str(event.id), 0)

            # Pick 1-4 free contiguous seats in the same row
            available = [
                s for s in seats if s.status == SeatStatus.AVAILABLE and s.zone_id
            ]
            if not available:
                continue
            group_size = random.randint(1, 4)

            # Don't exceed the 60 % cap
            if already_sold + group_size > max_sold:
                continue

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
            sold_per_event[str(event.id)] = already_sold + len(picked)
            booking_count += 1

        print(f"Seeded {len(users)} users, {len(venues)} venues, "
              f"{len(events_with_layout)} events, {booking_count} confirmed bookings.")
        print(f"Customer login example: {users[0].email} / {PASSWORD}")


if __name__ == "__main__":
    asyncio.run(main())
