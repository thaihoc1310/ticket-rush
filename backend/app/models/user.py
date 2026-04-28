from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Date, Enum, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.utils.enums import Gender, Role

if TYPE_CHECKING:
    from app.models.booking import Booking


class User(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    gender: Mapped[Gender | None] = mapped_column(
        Enum(Gender, name="gender_enum"), nullable=True
    )
    avatar: Mapped[str | None] = mapped_column(String(500), nullable=True)
    role: Mapped[Role] = mapped_column(
        Enum(Role, name="role_enum"),
        default=Role.CUSTOMER,
        nullable=False,
    )

    bookings: Mapped[list["Booking"]] = relationship(back_populates="user")
