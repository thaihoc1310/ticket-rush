from datetime import datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.event import Event
from app.models.venue import Venue
from app.models.zone import Zone
from app.schemas.event import EventCreate, EventUpdate, FilterMeta
from app.services.seat_layout_service import sync_event_seats_to_layout
from app.utils.enums import EventStatus


class EventService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _build_list_query(
        self,
        *,
        search: str | None = None,
        city: str | None = None,
        cities: list[str] | None = None,
        status_filter: EventStatus | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        price_min: float | None = None,
        price_max: float | None = None,
        categories: list[str] | None = None,
    ):
        """Build the base filtered query (without pagination/ordering)."""
        stmt = select(Event).options(selectinload(Event.venue), selectinload(Event.images))

        if search:
            like = f"%{search.lower()}%"
            stmt = stmt.where(
                or_(
                    Event.title.ilike(like),
                    Event.description.ilike(like),
                )
            )

        # Single city param (legacy compat) or multi-city list
        if cities:
            stmt = stmt.join(Event.venue).where(Venue.city.in_(cities))
        elif city:
            stmt = stmt.join(Event.venue).where(Venue.city.ilike(f"%{city}%"))

        if status_filter:
            stmt = stmt.where(Event.status == status_filter)
        if date_from:
            stmt = stmt.where(Event.event_date >= date_from)
        if date_to:
            stmt = stmt.where(Event.event_date <= date_to)
        if categories:
            stmt = stmt.where(Event.category.in_(categories))

        # Price range: filter events having at least one zone within the range
        if price_min is not None or price_max is not None:
            zone_subq = select(Zone.event_id).distinct()
            if price_min is not None:
                zone_subq = zone_subq.where(Zone.price >= price_min)
            if price_max is not None:
                zone_subq = zone_subq.where(Zone.price <= price_max)
            stmt = stmt.where(Event.id.in_(zone_subq))

        return stmt

    async def list(
        self,
        *,
        search: str | None = None,
        city: str | None = None,
        cities: list[str] | None = None,
        status_filter: EventStatus | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        price_min: float | None = None,
        price_max: float | None = None,
        categories: list[str] | None = None,
        sort_by: str = "event_date",
        sort_order: str = "asc",
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[Event], int]:
        stmt = self._build_list_query(
            search=search,
            city=city,
            cities=cities,
            status_filter=status_filter,
            date_from=date_from,
            date_to=date_to,
            price_min=price_min,
            price_max=price_max,
            categories=categories,
        )

        # Count before pagination
        count_stmt = select(func.count()).select_from(
            select(Event.id).where(stmt.whereclause).subquery()
            if stmt.whereclause is not None
            else select(Event.id).subquery()
        )
        # Rebuild count from the filtered statement properly
        count_stmt = select(func.count(func.distinct(Event.id))).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar() or 0

        # Sorting
        allowed_sorts = {"event_date", "title", "status", "created_at", "category"}
        col_name = sort_by if sort_by in allowed_sorts else "event_date"
        col = getattr(Event, col_name)
        stmt = stmt.order_by(col.desc() if sort_order == "desc" else col.asc())

        stmt = stmt.limit(limit).offset(offset)
        result = await self.db.execute(stmt)
        return list(result.scalars().unique().all()), total

    async def get_filter_meta(self) -> FilterMeta:
        """Return dynamic filter boundaries: price range, cities, categories."""
        # Min/max zone prices
        price_stmt = select(func.min(Zone.price), func.max(Zone.price))
        price_result = await self.db.execute(price_stmt)
        row = price_result.one()
        min_price = float(row[0]) if row[0] is not None else 0
        max_price = float(row[1]) if row[1] is not None else 0

        # Distinct cities from venues linked to events
        city_stmt = (
            select(Venue.city)
            .distinct()
            .join(Event, Event.venue_id == Venue.id)
            .order_by(Venue.city)
        )
        city_result = await self.db.execute(city_stmt)
        cities = [r[0] for r in city_result.all()]

        # Distinct categories
        cat_stmt = (
            select(Event.category)
            .distinct()
            .where(Event.category.is_not(None))
            .order_by(Event.category)
        )
        cat_result = await self.db.execute(cat_stmt)
        categories = [r[0] for r in cat_result.all()]

        return FilterMeta(
            min_price=min_price,
            max_price=max_price,
            cities=cities,
            categories=categories,
        )

    async def get(self, event_id: UUID) -> Event:
        stmt = (
            select(Event)
            .where(Event.id == event_id)
            .options(selectinload(Event.venue), selectinload(Event.images))
        )
        result = await self.db.execute(stmt)
        event = result.scalar_one_or_none()
        if event is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
        return event

    async def _ensure_venue(self, venue_id: UUID) -> Venue:
        venue = await self.db.get(Venue, venue_id)
        if venue is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Venue does not exist")
        return venue

    async def create(self, data: EventCreate) -> Event:
        venue = await self._ensure_venue(data.venue_id)
        event = Event(**data.model_dump())
        self.db.add(event)
        await self.db.flush()

        # Auto-generate seats for every position in the venue layout.
        # Seats start with zone_id=NULL; admin assigns zones via bulk endpoint.
        await sync_event_seats_to_layout(
            self.db,
            event_id=event.id,
            grid_rows=venue.grid_rows,
            grid_cols=venue.grid_cols,
        )
        await self.db.commit()
        return await self.get(event.id)

    async def update(self, event_id: UUID, data: EventUpdate) -> Event:
        event = await self.get(event_id)
        payload = data.model_dump(exclude_unset=True)

        if "status" in payload:
            new_status = payload["status"]
            if event.status == EventStatus.ENDED and new_status != EventStatus.ENDED:
                now = datetime.now(event.event_date.tzinfo) if event.event_date.tzinfo else datetime.now()
                if event.event_date <= now:
                    raise HTTPException(
                        status.HTTP_400_BAD_REQUEST, 
                        "Cannot change status of an ended event because its date has already passed."
                    )

        new_venue: Venue | None = None
        if "venue_id" in payload:
            if payload["venue_id"] is None:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST, "Venue cannot be empty"
                )
            new_venue = await self._ensure_venue(payload["venue_id"])
        for field, value in payload.items():
            setattr(event, field, value)
        if new_venue is not None:
            await sync_event_seats_to_layout(
                self.db,
                event_id=event.id,
                grid_rows=new_venue.grid_rows,
                grid_cols=new_venue.grid_cols,
            )
        await self.db.commit()
        return await self.get(event_id)

    async def delete(self, event_id: UUID) -> None:
        event = await self.get(event_id)
        await self.db.delete(event)
        await self.db.commit()
