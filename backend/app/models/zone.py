from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.event import Event
    from app.models.seat import Seat


class Zone(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "zones"

    event_id: Mapped[UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    color: Mapped[str] = mapped_column(String(9), nullable=False, default="#4f46e5")
    total_rows: Mapped[int | None] = mapped_column(Integer, nullable=True)
    seats_per_row: Mapped[int | None] = mapped_column(Integer, nullable=True)

    event: Mapped["Event"] = relationship(back_populates="zones")
    seats: Mapped[list["Seat"]] = relationship(
        back_populates="zone",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
