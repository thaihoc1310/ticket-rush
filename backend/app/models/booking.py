from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Enum, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.utils.enums import BookingStatus

if TYPE_CHECKING:
    from app.models.payment import Payment
    from app.models.seat import Seat
    from app.models.ticket import Ticket


class Booking(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "bookings"

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    event_id: Mapped[UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[BookingStatus] = mapped_column(
        Enum(BookingStatus, name="booking_status_enum"),
        default=BookingStatus.PENDING,
        nullable=False,
        index=True,
    )

    items: Mapped[list["BookingItem"]] = relationship(
        back_populates="booking",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    payment: Mapped["Payment | None"] = relationship(
        back_populates="booking",
        uselist=False,
        cascade="all, delete-orphan",
        lazy="joined",
    )


class BookingItem(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "booking_items"

    booking_id: Mapped[UUID] = mapped_column(
        ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    seat_id: Mapped[UUID] = mapped_column(
        ForeignKey("seats.id", ondelete="RESTRICT"), nullable=False, unique=True
    )
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    booking: Mapped["Booking"] = relationship(back_populates="items")
    seat: Mapped["Seat"] = relationship(lazy="joined")
    ticket: Mapped["Ticket | None"] = relationship(
        back_populates="booking_item",
        uselist=False,
        cascade="all, delete-orphan",
        lazy="joined",
    )
