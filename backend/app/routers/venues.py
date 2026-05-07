from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import require_admin
from app.schemas.pagination import PaginatedResponse
from app.schemas.venue import VenueCreate, VenueOut, VenueUpdate
from app.services.venue_service import VenueService

router = APIRouter(prefix="/api/venues", tags=["venues"])


class VenueFilterMeta(BaseModel):
    cities: list[str]


@router.get("/filter-meta", response_model=VenueFilterMeta)
async def get_venue_filter_meta(db: AsyncSession = Depends(get_db)):
    return await VenueService(db).filter_meta()


@router.get("", response_model=PaginatedResponse[VenueOut])
async def list_venues(
    db: AsyncSession = Depends(get_db),
    q: str | None = Query(default=None, description="Search name, address, city"),
    cities: str | None = Query(default=None, description="Comma-separated city names"),
    sort: str = Query(default="name", description="Sort field"),
    order: str = Query(default="asc", regex="^(asc|desc)$"),
    limit: int = Query(default=10, ge=1, le=200, alias="size"),
    offset: int = Query(default=0, ge=0),
    page: int | None = Query(default=None, ge=1),
):
    # Allow page-based pagination (page takes priority over offset)
    if page is not None:
        offset = (page - 1) * limit

    city_list = [c.strip() for c in cities.split(",") if c.strip()] if cities else None

    items, total = await VenueService(db).list(
        search=q,
        cities=city_list,
        sort_by=sort,
        sort_order=order,
        limit=limit,
        offset=offset,
    )
    return PaginatedResponse(items=items, total=total)


@router.get("/{venue_id}", response_model=VenueOut)
async def get_venue(venue_id: UUID, db: AsyncSession = Depends(get_db)):
    return await VenueService(db).get(venue_id)


@router.post(
    "",
    response_model=VenueOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
async def create_venue(data: VenueCreate, db: AsyncSession = Depends(get_db)):
    return await VenueService(db).create(data)


@router.patch(
    "/{venue_id}",
    response_model=VenueOut,
    dependencies=[Depends(require_admin)],
)
async def update_venue(
    venue_id: UUID, data: VenueUpdate, db: AsyncSession = Depends(get_db)
):
    return await VenueService(db).update(venue_id, data)


@router.delete(
    "/{venue_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin)],
)
async def delete_venue(venue_id: UUID, db: AsyncSession = Depends(get_db)):
    await VenueService(db).delete(venue_id)
