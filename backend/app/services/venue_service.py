from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.models.venue import Venue
from app.schemas.venue import VenueCreate, VenueUpdate
from app.services.seat_layout_service import sync_event_seats_to_layout


class VenueService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(
        self,
        *,
        search: str | None = None,
        cities: list[str] | None = None,
        sort_by: str = "name",
        sort_order: str = "asc",
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[Venue], int]:
        stmt = select(Venue)

        # Text search
        if search:
            like = f"%{search.lower()}%"
            stmt = stmt.where(
                or_(
                    Venue.name.ilike(like),
                    Venue.address.ilike(like),
                    Venue.city.ilike(like),
                )
            )

        # City filter
        if cities:
            stmt = stmt.where(Venue.city.in_(cities))

        # Count before pagination
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self.db.execute(count_stmt)).scalar() or 0

        # Sorting
        allowed_sorts = {"name", "city", "created_at", "grid_rows", "grid_cols"}
        col_name = sort_by if sort_by in allowed_sorts else "name"
        col = getattr(Venue, col_name)
        stmt = stmt.order_by(col.desc() if sort_order == "desc" else col.asc())

        # Pagination
        stmt = stmt.limit(limit).offset(offset)
        result = await self.db.execute(stmt)
        return list(result.scalars().all()), total

    async def filter_meta(self) -> dict:
        """Return dynamic filter options for the venue list."""
        city_stmt = (
            select(Venue.city)
            .distinct()
            .order_by(Venue.city)
        )
        city_result = await self.db.execute(city_stmt)
        cities = [r[0] for r in city_result.all()]
        return {"cities": cities}

    async def get(self, venue_id: UUID) -> Venue:
        venue = await self.db.get(Venue, venue_id)
        if venue is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Venue not found")
        return venue

    async def create(self, data: VenueCreate) -> Venue:
        venue = Venue(**data.model_dump())
        self.db.add(venue)
        await self.db.commit()
        await self.db.refresh(venue)
        return venue

    async def update(self, venue_id: UUID, data: VenueUpdate) -> Venue:
        venue = await self.get(venue_id)
        payload = data.model_dump(exclude_unset=True)
        if payload.get("grid_rows") is None and "grid_rows" in payload:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Grid rows cannot be empty")
        if payload.get("grid_cols") is None and "grid_cols" in payload:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Grid cols cannot be empty")

        new_rows = payload.get("grid_rows", venue.grid_rows)
        new_cols = payload.get("grid_cols", venue.grid_cols)
        layout_changed = new_rows != venue.grid_rows or new_cols != venue.grid_cols

        if layout_changed:
            result = await self.db.execute(
                select(Event.id).where(Event.venue_id == venue_id)
            )
            event_ids = list(result.scalars().all())
            for event_id in event_ids:
                await sync_event_seats_to_layout(
                    self.db,
                    event_id=event_id,
                    grid_rows=new_rows,
                    grid_cols=new_cols,
                )

        for field, value in payload.items():
            setattr(venue, field, value)
        await self.db.commit()
        await self.db.refresh(venue)
        return venue

    async def delete(self, venue_id: UUID) -> None:
        venue = await self.get(venue_id)
        await self.db.delete(venue)
        await self.db.commit()
