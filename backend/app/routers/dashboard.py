from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import require_admin
from app.schemas.dashboard import (
    DemographicsOut,
    OccupancyOut,
    RevenuePoint,
    SummaryOut,
)
from app.services.dashboard_service import DashboardService

router = APIRouter(
    prefix="/api/dashboard",
    tags=["dashboard"],
    dependencies=[Depends(require_admin)],
)


@router.get("/summary", response_model=SummaryOut)
async def summary(db: AsyncSession = Depends(get_db)):
    return await DashboardService(db).summary()


@router.get("/revenue", response_model=list[RevenuePoint])
async def revenue(
    db: AsyncSession = Depends(get_db),
    days: int = Query(default=30, ge=1, le=365),
):
    return await DashboardService(db).revenue_series(days=days)


@router.get("/occupancy/{event_id}", response_model=OccupancyOut)
async def occupancy(event_id: UUID, db: AsyncSession = Depends(get_db)):
    return await DashboardService(db).occupancy_for_event(event_id)


@router.get("/demographics", response_model=DemographicsOut)
async def demographics(db: AsyncSession = Depends(get_db)):
    return await DashboardService(db).demographics()


@router.get("/top-events")
async def top_events(
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=5, ge=1, le=20),
):
    return await DashboardService(db).top_events(limit=limit)
