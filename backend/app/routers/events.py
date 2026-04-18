from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import require_admin
from app.schemas.event import EventCreate, EventDetail, EventSummary, EventUpdate
from app.services.event_service import EventService
from app.utils.enums import EventStatus

router = APIRouter(prefix="/api/events", tags=["events"])


@router.get("", response_model=list[EventSummary])
async def list_events(
    db: AsyncSession = Depends(get_db),
    q: str | None = Query(default=None, description="search in title/description"),
    city: str | None = None,
    status_filter: EventStatus | None = Query(default=None, alias="status"),
    upcoming: bool = False,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    return await EventService(db).list(
        search=q,
        city=city,
        status_filter=status_filter,
        upcoming_only=upcoming,
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
