from uuid import UUID

from fastapi import APIRouter, Depends, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import require_admin
from app.redis import get_redis
from app.schemas.zone import BulkAssignRequest, ZoneCreate, ZoneOut, ZoneUpdate
from app.services.zone_service import ZoneService

router = APIRouter(tags=["zones"])


def _zone_to_out(zone, count: int = 0) -> ZoneOut:
    return ZoneOut(
        id=zone.id,
        event_id=zone.event_id,
        name=zone.name,
        price=zone.price,
        color=zone.color,
        seat_count=count,
    )


@router.get("/api/events/{event_id}/zones", response_model=list[ZoneOut])
async def list_zones(event_id: UUID, db: AsyncSession = Depends(get_db)):
    rows = await ZoneService(db).list_for_event(event_id)
    return [_zone_to_out(z, count) for z, count in rows]


@router.post(
    "/api/events/{event_id}/zones",
    response_model=ZoneOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
async def create_zone(
    event_id: UUID, data: ZoneCreate, db: AsyncSession = Depends(get_db)
):
    zone = await ZoneService(db).create(event_id, data)
    return _zone_to_out(zone, 0)


@router.patch(
    "/api/zones/{zone_id}",
    response_model=ZoneOut,
    dependencies=[Depends(require_admin)],
)
async def update_zone(
    zone_id: UUID, data: ZoneUpdate, db: AsyncSession = Depends(get_db)
):
    zone = await ZoneService(db).update(zone_id, data)
    return _zone_to_out(zone, 0)


@router.delete(
    "/api/zones/{zone_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin)],
)
async def delete_zone(zone_id: UUID, db: AsyncSession = Depends(get_db)):
    await ZoneService(db).delete(zone_id)


@router.post(
    "/api/events/{event_id}/seats/bulk-assign",
    dependencies=[Depends(require_admin)],
)
async def bulk_assign_seats(
    event_id: UUID,
    data: BulkAssignRequest,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    updated = await ZoneService(db).bulk_assign_seats(
        event_id=event_id,
        seat_ids=data.seat_ids,
        zone_id=data.zone_id,
        redis=redis,
    )
    return {"updated": updated}
