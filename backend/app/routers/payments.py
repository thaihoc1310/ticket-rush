from datetime import datetime
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies.auth import require_admin
from app.models.booking import Booking
from app.models.event import Event
from app.models.payment import Payment
from app.models.user import User
from app.schemas.pagination import PaginatedResponse
from app.utils.enums import BookingStatus, PaymentStatus


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


class PaymentFilterMeta(BaseModel):
    methods: list[str]
    statuses: list[str]
    min_amount: float
    max_amount: float


router = APIRouter(
    prefix="/api/payments",
    tags=["payments"],
    dependencies=[Depends(require_admin)],
)


@router.get("/filter-meta", response_model=PaymentFilterMeta)
async def get_payment_filter_meta(db: AsyncSession = Depends(get_db)):
    # Distinct methods
    method_result = await db.execute(
        select(Payment.method).distinct().order_by(Payment.method)
    )
    methods = [r[0] for r in method_result.all()]

    # Distinct statuses
    status_result = await db.execute(
        select(Payment.status).distinct().order_by(Payment.status)
    )
    statuses = [r[0].value if hasattr(r[0], "value") else str(r[0]) for r in status_result.all()]

    # Amount bounds
    bounds_result = await db.execute(
        select(func.min(Payment.amount), func.max(Payment.amount))
    )
    row = bounds_result.one()
    min_amount = float(row[0]) if row[0] is not None else 0
    max_amount = float(row[1]) if row[1] is not None else 0

    return PaymentFilterMeta(
        methods=methods,
        statuses=statuses,
        min_amount=min_amount,
        max_amount=max_amount,
    )


@router.get("", response_model=PaginatedResponse[PaymentAdminOut])
async def list_payments(
    db: AsyncSession = Depends(get_db),
    q: str | None = Query(default=None, description="Search event title or user email"),
    statuses: str | None = Query(default=None, description="Comma-separated statuses"),
    methods: str | None = Query(default=None, description="Comma-separated methods"),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    amount_min: float | None = Query(default=None, ge=0),
    amount_max: float | None = Query(default=None, ge=0),
    sort: str = Query(default="created_at", description="Sort field"),
    order: str = Query(default="desc", regex="^(asc|desc)$"),
    limit: int = Query(default=10, ge=1, le=500, alias="size"),
    offset: int = Query(default=0, ge=0),
    page: int | None = Query(default=None, ge=1),
):
    if page is not None:
        offset = (page - 1) * limit

    stmt = (
        select(Payment)
        .join(Payment.booking)
        .join(Booking.user)
        .join(Booking.event)
        .options(
            selectinload(Payment.booking).selectinload(Booking.user),
            selectinload(Payment.booking).selectinload(Booking.event),
        )
    )

    # Text search on event title or user email
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(
            or_(
                Event.title.ilike(like),
                User.email.ilike(like),
            )
        )

    # Status filter
    if statuses:
        status_list = [PaymentStatus(s.strip()) for s in statuses.split(",") if s.strip()]
        stmt = stmt.where(Payment.status.in_(status_list))

    # Method filter
    if methods:
        method_list = [m.strip() for m in methods.split(",") if m.strip()]
        stmt = stmt.where(Payment.method.in_(method_list))

    # Date range
    if date_from:
        stmt = stmt.where(Payment.paid_at >= date_from)
    if date_to:
        stmt = stmt.where(Payment.paid_at <= date_to)

    # Amount range
    if amount_min is not None:
        stmt = stmt.where(Payment.amount >= amount_min)
    if amount_max is not None:
        stmt = stmt.where(Payment.amount <= amount_max)

    # Count before pagination
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    # Sorting
    allowed_sorts = {"created_at", "amount", "method", "status", "paid_at"}
    col_name = sort if sort in allowed_sorts else "created_at"
    col = getattr(Payment, col_name)
    stmt = stmt.order_by(col.desc() if order == "desc" else col.asc())

    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    payments = result.scalars().unique().all()

    items = []
    for p in payments:
        items.append(PaymentAdminOut(
            id=p.id,
            booking_id=p.booking_id,
            amount=p.amount,
            method=p.method,
            status=p.status,
            paid_at=p.paid_at,
            user_email=p.booking.user.email if p.booking and p.booking.user else None,
            event_title=p.booking.event.title if p.booking and p.booking.event else None,
            booking_status=p.booking.status if p.booking else None,
        ))
    return PaginatedResponse(items=items, total=total)
