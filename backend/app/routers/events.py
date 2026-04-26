from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import require_admin
from app.schemas.event import EventCreate, EventDetail, EventSummary, EventUpdate, FilterMeta
from app.services.event_service import EventService
from app.utils.enums import EventStatus

router = APIRouter(prefix="/api/events", tags=["events"])


@router.get("/filter-meta", response_model=FilterMeta)
async def get_filter_meta(db: AsyncSession = Depends(get_db)):
    return await EventService(db).get_filter_meta()


@router.get("", response_model=list[EventSummary])
async def list_events(
    db: AsyncSession = Depends(get_db),
    q: str | None = Query(default=None, description="search in title/description"),
    city: str | None = None,
    cities: str | None = Query(default=None, description="comma-separated city names"),
    status_filter: EventStatus | None = Query(default=None, alias="status"),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    price_min: float | None = Query(default=None, ge=0),
    price_max: float | None = Query(default=None, ge=0),
    categories: str | None = Query(default=None, description="comma-separated categories"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    city_list = [c.strip() for c in cities.split(",") if c.strip()] if cities else None
    cat_list = [c.strip() for c in categories.split(",") if c.strip()] if categories else None

    return await EventService(db).list(
        search=q,
        city=city,
        cities=city_list,
        status_filter=status_filter,
        date_from=date_from,
        date_to=date_to,
        price_min=price_min,
        price_max=price_max,
        categories=cat_list,
        limit=limit,
        offset=offset,
    )


@router.get("/{event_id}", response_model=EventDetail)
async def get_event(event_id: UUID, db: AsyncSession = Depends(get_db)):
    return await EventService(db).get(event_id)


@router.post(
    "",
    response_model=EventDetail,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
async def create_event(data: EventCreate, db: AsyncSession = Depends(get_db)):
    return await EventService(db).create(data)


@router.patch(
    "/{event_id}",
    response_model=EventDetail,
    dependencies=[Depends(require_admin)],
)
async def update_event(
    event_id: UUID, data: EventUpdate, db: AsyncSession = Depends(get_db)
):
    return await EventService(db).update(event_id, data)


@router.delete(
    "/{event_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin)],
)
async def delete_event(event_id: UUID, db: AsyncSession = Depends(get_db)):
    await EventService(db).delete(event_id)
