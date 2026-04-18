from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import require_admin
from app.schemas.venue import VenueCreate, VenueOut, VenueUpdate
from app.services.venue_service import VenueService

router = APIRouter(prefix="/api/venues", tags=["venues"])


@router.get("", response_model=list[VenueOut])
async def list_venues(db: AsyncSession = Depends(get_db)):
    return await VenueService(db).list()


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
