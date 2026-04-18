from typing import TYPE_CHECKING

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.event import Event


class Venue(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "venues"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[str] = mapped_column(String(500), nullable=False)
    city: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    events: Mapped[list["Event"]] = relationship(back_populates="venue")
