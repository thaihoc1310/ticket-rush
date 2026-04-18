from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.booking import Booking, BookingItem
from app.models.event import Event
from app.models.payment import Payment
from app.models.seat import Seat
from app.models.ticket import Ticket
from app.models.user import User
from app.models.zone import Zone
from app.schemas.dashboard import (
    AgeBucket,
    DemographicsOut,
    GenderBucket,
    OccupancyOut,
    OccupancyZone,
    RevenuePoint,
    SummaryOut,
)
from app.utils.enums import (
    BookingStatus,
    EventStatus,
    PaymentStatus,
    SeatStatus,
    TicketStatus,
)


class DashboardService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def summary(self) -> SummaryOut:
        now = datetime.now(UTC)

        revenue = await self.db.scalar(
            select(func.coalesce(func.sum(Payment.amount), 0)).where(
                Payment.status == PaymentStatus.COMPLETED
            )
        )
        confirmed = await self.db.scalar(
            select(func.count(Booking.id)).where(
                Booking.status == BookingStatus.CONFIRMED
            )
        )
        tickets = await self.db.scalar(
            select(func.count(Ticket.id)).where(Ticket.status == TicketStatus.VALID)
        )
        users = await self.db.scalar(select(func.count(User.id)))
        upcoming = await self.db.scalar(
            select(func.count(Event.id)).where(Event.event_date >= now)
        )
        published = await self.db.scalar(
            select(func.count(Event.id)).where(Event.status == EventStatus.PUBLISHED)
        )

        return SummaryOut(
            total_revenue=Decimal(revenue or 0),
            confirmed_bookings=int(confirmed or 0),
            total_tickets=int(tickets or 0),
            registered_users=int(users or 0),
            upcoming_events=int(upcoming or 0),
            published_events=int(published or 0),
        )

    async def revenue_series(self, days: int = 30) -> list[RevenuePoint]:
        if days < 1 or days > 365:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "days must be between 1 and 365"
            )
        end = datetime.now(UTC).date() + timedelta(days=1)
        start = end - timedelta(days=days)

        day = func.date_trunc("day", Payment.paid_at).label("day")
        stmt = (
            select(
                day,
                func.coalesce(func.sum(Payment.amount), 0).label("revenue"),
                func.count(Payment.id).label("bookings"),
            )
            .where(Payment.status == PaymentStatus.COMPLETED)
            .where(Payment.paid_at.is_not(None))
            .where(Payment.paid_at >= datetime.combine(start, datetime.min.time(), UTC))
            .where(Payment.paid_at < datetime.combine(end, datetime.min.time(), UTC))
            .group_by(day)
            .order_by(day)
        )
        rows = (await self.db.execute(stmt)).all()
        by_day: dict[date, tuple[Decimal, int]] = {
            row.day.date(): (Decimal(row.revenue or 0), int(row.bookings or 0))
            for row in rows
        }

        series: list[RevenuePoint] = []
        for i in range(days):
            d = start + timedelta(days=i)
            rev, bkg = by_day.get(d, (Decimal(0), 0))
            series.append(RevenuePoint(date=d, revenue=rev, bookings=bkg))
        return series

    async def occupancy_for_event(self, event_id) -> OccupancyOut:
        event = await self.db.get(Event, event_id)
        if event is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")

        # Aggregate per seat status for whole event (even unassigned).
        stmt = (
            select(Seat.status, Seat.zone_id, func.count(Seat.id))
            .where(Seat.event_id == event_id)
            .group_by(Seat.status, Seat.zone_id)
        )
        rows = (await self.db.execute(stmt)).all()

        total = sold = locked = available = unassigned = 0
        per_zone: dict = {}
        for seat_status, zone_id, count in rows:
            count = int(count)
            total += count
            if zone_id is None:
                unassigned += count
                continue
            bucket = per_zone.setdefault(
                zone_id,
                {"sold": 0, "locked": 0, "available": 0, "total": 0},
            )
            bucket["total"] += count
            if seat_status == SeatStatus.SOLD:
                sold += count
                bucket["sold"] += count
            elif seat_status == SeatStatus.LOCKED:
                locked += count
                bucket["locked"] += count
            elif seat_status == SeatStatus.AVAILABLE:
                available += count
                bucket["available"] += count

        zones_rs = await self.db.execute(
            select(Zone).where(Zone.event_id == event_id).order_by(Zone.name)
        )
        zones = list(zones_rs.scalars().all())
        by_zone = [
            OccupancyZone(
                zone_id=z.id,
                name=z.name,
                color=z.color,
                total=per_zone.get(z.id, {}).get("total", 0),
                sold=per_zone.get(z.id, {}).get("sold", 0),
                locked=per_zone.get(z.id, {}).get("locked", 0),
                available=per_zone.get(z.id, {}).get("available", 0),
            )
            for z in zones
        ]

        return OccupancyOut(
            event_id=event.id,
            event_title=event.title,
            event_date=event.event_date,
            total_seats=total,
            sold=sold,
            locked=locked,
            available=available,
            unassigned=unassigned,
            by_zone=by_zone,
        )

    async def demographics(self) -> DemographicsOut:
        # Count distinct users who have at least one CONFIRMED booking.
        confirmed_users_subq = (
            select(User.id.label("user_id"), User.gender, User.date_of_birth)
            .join(Booking, Booking.user_id == User.id)
            .where(Booking.status == BookingStatus.CONFIRMED)
            .distinct()
            .subquery()
        )

        gender_rows = await self.db.execute(
            select(
                confirmed_users_subq.c.gender,
                func.count(confirmed_users_subq.c.user_id).label("count"),
            ).group_by(confirmed_users_subq.c.gender)
        )
        gender_map: dict[str, int] = {}
        for row in gender_rows.all():
            key = row.gender.value if row.gender is not None else "UNKNOWN"
            gender_map[key] = gender_map.get(key, 0) + int(row.count)
        by_gender = [
            GenderBucket(gender=g, count=c) for g, c in gender_map.items()
        ]

        # Age buckets computed in Python to stay DB-agnostic.
        age_rows = await self.db.execute(
            select(confirmed_users_subq.c.date_of_birth).where(
                confirmed_users_subq.c.date_of_birth.is_not(None)
            )
        )
        today = datetime.now(UTC).date()
        buckets: dict[str, int] = {
            "<18": 0,
            "18-24": 0,
            "25-34": 0,
            "35-44": 0,
            "45-54": 0,
            "55+": 0,
        }
        dob_count = 0
        for (dob,) in age_rows.all():
            if dob is None:
                continue
            age = (today - dob).days // 365
            if age < 18:
                buckets["<18"] += 1
            elif age < 25:
                buckets["18-24"] += 1
            elif age < 35:
                buckets["25-34"] += 1
            elif age < 45:
                buckets["35-44"] += 1
            elif age < 55:
                buckets["45-54"] += 1
            else:
                buckets["55+"] += 1
            dob_count += 1

        total_confirmed = sum(g.count for g in by_gender)
        unknown_age = total_confirmed - dob_count
        by_age = [AgeBucket(bracket=k, count=v) for k, v in buckets.items()]
        if unknown_age > 0:
            by_age.append(AgeBucket(bracket="unknown", count=unknown_age))

        return DemographicsOut(by_gender=by_gender, by_age=by_age, total=total_confirmed)

    async def top_events(self, limit: int = 5):
        """Return top events by confirmed-ticket count (helper for dashboard widget)."""
        stmt = (
            select(
                Event.id,
                Event.title,
                Event.event_date,
                func.count(BookingItem.id).label("tickets"),
                func.coalesce(func.sum(BookingItem.price), 0).label("revenue"),
            )
            .join(Booking, Booking.event_id == Event.id)
            .join(BookingItem, BookingItem.booking_id == Booking.id)
            .where(Booking.status == BookingStatus.CONFIRMED)
            .group_by(Event.id)
            .order_by(func.count(BookingItem.id).desc())
            .limit(limit)
        )
        rows = (await self.db.execute(stmt)).all()
        return [
            {
                "event_id": str(r.id),
                "title": r.title,
                "event_date": r.event_date,
                "tickets": int(r.tickets),
                "revenue": Decimal(r.revenue or 0),
            }
            for r in rows
        ]
