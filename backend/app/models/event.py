from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.utils.enums import EventStatus

if TYPE_CHECKING:
    from app.models.event_image import EventImage
    from app.models.seat import Seat
    from app.models.venue import Venue
    from app.models.zone import Zone


class Event(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "events"

    venue_id: Mapped[UUID] = mapped_column(
        ForeignKey("venues.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    event_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    sale_start_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    banner_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[EventStatus] = mapped_column(
        Enum(EventStatus, name="event_status_enum"),
        default=EventStatus.DRAFT,
        nullable=False,
        index=True,
    )
    grid_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    grid_cols: Mapped[int] = mapped_column(Integer, nullable=False, default=15)
    category: Mapped[str | None] = mapped_column(String(60), nullable=True, index=True)

    venue: Mapped["Venue"] = relationship(back_populates="events", lazy="joined")
    zones: Mapped[list["Zone"]] = relationship(
        back_populates="event",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    seats: Mapped[list["Seat"]] = relationship(
        back_populates="event",
        cascade="all, delete-orphan",
    )
    images: Mapped[list["EventImage"]] = relationship(
        back_populates="event",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="EventImage.display_order",
    )
