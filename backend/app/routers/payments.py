from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies.auth import require_admin
from app.models.booking import Booking
from app.models.payment import Payment
from app.schemas.booking import PaymentOut
from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from app.utils.enums import PaymentStatus, BookingStatus


class PaymentAdminOut(BaseModel):
    id: UUID
    booking_id: UUID
    amount: Decimal
    method: str
    status: PaymentStatus
    paid_at: datetime | None
    user_email: str | None = None
    event_title: str | None = None
    booking_status: BookingStatus | None = None

    class Config:
        from_attributes = True


router = APIRouter(
    prefix="/api/payments",
    tags=["payments"],
    dependencies=[Depends(require_admin)],
)


@router.get("", response_model=list[PaymentAdminOut])
async def list_payments(
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    stmt = (
        select(Payment)
        .options(
            selectinload(Payment.booking).selectinload(Booking.user),
            selectinload(Payment.booking).selectinload(Booking.event),
        )
        .order_by(Payment.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    payments = result.scalars().unique().all()
    out = []
    for p in payments:
        item = PaymentAdminOut(
            id=p.id,
            booking_id=p.booking_id,
            amount=p.amount,
            method=p.method,
            status=p.status,
            paid_at=p.paid_at,
            user_email=p.booking.user.email if p.booking and p.booking.user else None,
            event_title=p.booking.event.title if p.booking and p.booking.event else None,
            booking_status=p.booking.status if p.booking else None,
        )
        out.append(item)
    return out
