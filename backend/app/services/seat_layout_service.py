from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.seat import Seat
from app.utils.enums import SeatStatus


async def sync_event_seats_to_layout(
    db: AsyncSession,
    *,
    event_id: UUID,
    grid_rows: int,
    grid_cols: int,
) -> None:
    """Keep an event's seat matrix aligned with its venue layout."""
    outside_stmt = select(Seat).where(
        Seat.event_id == event_id,
        or_(Seat.row_number > grid_rows, Seat.seat_number > grid_cols),
    )
    outside_seats = list((await db.execute(outside_stmt)).scalars().all())
    blocked = [
        seat
        for seat in outside_seats
        if seat.status != SeatStatus.AVAILABLE
        or seat.zone_id is not None
        or seat.locked_by is not None
    ]
    if blocked:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Cannot shrink venue layout while affected seats are assigned, locked, or sold",
        )

    for seat in outside_seats:
        await db.delete(seat)

    existing_stmt = select(Seat.row_number, Seat.seat_number).where(
        Seat.event_id == event_id
    )
    existing = {
        (row_number, seat_number)
        for row_number, seat_number in (await db.execute(existing_stmt)).all()
    }
    new_seats = [
        Seat(
            event_id=event_id,
            zone_id=None,
            row_number=row,
            seat_number=col,
            status=SeatStatus.AVAILABLE,
        )
        for row in range(1, grid_rows + 1)
        for col in range(1, grid_cols + 1)
        if (row, col) not in existing
    ]
    if new_seats:
        db.add_all(new_seats)
