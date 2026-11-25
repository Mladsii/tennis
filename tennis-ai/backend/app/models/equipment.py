import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class Equipment(UUIDMixin, TimestampMixin, Base):
    """Инвентарь клуба (ракетки, мячи, корзины, ...)."""
    __tablename__ = "equipment"

    location_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("locations.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(150))
    # "racket" | "balls" | "basket" | "other"
    equipment_type: Mapped[str] = mapped_column(String(20), index=True)
    quantity_total: Mapped[int] = mapped_column(Integer, default=1)
    quantity_available: Mapped[int] = mapped_column(Integer, default=1)
    price_per_hour: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    location: Mapped["Location"] = relationship()
    rentals: Mapped[list["EquipmentRental"]] = relationship(
        back_populates="equipment", cascade="all, delete-orphan"
    )


class EquipmentRental(UUIDMixin, TimestampMixin, Base):
    """Запись об аренде инвентаря."""
    __tablename__ = "equipment_rentals"

    equipment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("equipment.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    booking_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("court_bookings.id", ondelete="SET NULL"), nullable=True
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    rented_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    returned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # "active" | "returned"
    status: Mapped[str] = mapped_column(String(10), default="active", index=True)

    equipment: Mapped["Equipment"] = relationship(back_populates="rentals")
    user: Mapped["User | None"] = relationship(foreign_keys=[user_id])
    created_by: Mapped["User | None"] = relationship(foreign_keys=[created_by_id])


from app.models.location import Location  # noqa: E402
from app.models.user import User  # noqa: E402
