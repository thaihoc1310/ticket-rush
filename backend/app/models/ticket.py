from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin
from app.utils.enums import TicketStatus

if TYPE_CHECKING:
    from app.models.booking import BookingItem


class Ticket(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "tickets"

    booking_item_id: Mapped[UUID] = mapped_column(
        ForeignKey("booking_items.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    qr_data: Mapped[str] = mapped_column(String(500), nullable=False)
    status: Mapped[TicketStatus] = mapped_column(
        Enum(TicketStatus, name="ticket_status_enum"),
        default=TicketStatus.VALID,
        nullable=False,
        index=True,
    )
    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    booking_item: Mapped["BookingItem"] = relationship(back_populates="ticket")
