from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin
from app.utils.enums import SeatStatus

if TYPE_CHECKING:
    from app.models.event import Event
    from app.models.zone import Zone


class Seat(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "seats"
    __table_args__ = (
        UniqueConstraint("event_id", "row_number", "seat_number", name="uq_seat_position"),
    )

    event_id: Mapped[UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    zone_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("zones.id", ondelete="SET NULL"), nullable=True, index=True
    )
    row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    seat_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[SeatStatus] = mapped_column(
        Enum(SeatStatus, name="seat_status_enum"),
        default=SeatStatus.AVAILABLE,
        nullable=False,
        index=True,
    )
    locked_by: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    locked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    zone: Mapped["Zone | None"] = relationship(back_populates="seats")
    event: Mapped["Event"] = relationship(back_populates="seats")
