import uuid

from decimal import Decimal

from sqlalchemy import Boolean, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class Location(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "locations"

    name: Mapped[str] = mapped_column(String(200))
    address: Mapped[str] = mapped_column(Text)
    city: Mapped[str] = mapped_column(String(100), index=True)
    latitude: Mapped[float] = mapped_column(Numeric(9, 6))
    longitude: Mapped[float] = mapped_column(Numeric(9, 6))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    courts: Mapped[list["Court"]] = relationship(
        back_populates="location", cascade="all, delete-orphan"
    )


class Court(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "courts"

    location_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("locations.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(100))
    sport: Mapped[str] = mapped_column(String(10), default="tennis", index=True)  # 'tennis' or 'padel'
    is_singles_only: Mapped[bool] = mapped_column(Boolean, default=False)
    is_doubles_or_singles: Mapped[bool] = mapped_column(Boolean, default=True)
    court_type: Mapped[str] = mapped_column(String(10))  # 'indoor' or 'outdoor'
    surface_type: Mapped[str] = mapped_column(String(20))
    photo_url: Mapped[str | None] = mapped_column(String(500))
    price_per_slot: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    location: Mapped["Location"] = relationship(back_populates="courts")
