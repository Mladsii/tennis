import uuid
from datetime import date, datetime, time

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, SmallInteger, String, Text, Time, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class CourtBooking(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "court_bookings"

    court_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("courts.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    date: Mapped[date] = mapped_column(Date, index=True)
    slot_start: Mapped[time] = mapped_column(Time)   # e.g. 08:00
    slot_end: Mapped[time] = mapped_column(Time)     # e.g. 08:30

    # 'active' | 'cancelled'
    status: Mapped[str] = mapped_column(String(10), default="active", index=True)
    notes: Mapped[str | None] = mapped_column(Text)

    # ТЗ: статус оплаты — 'unpaid' | 'cash' | 'card' | 'sbp'
    payment_status: Mapped[str] = mapped_column(String(10), default="unpaid", server_default="unpaid")

    # ТЗ: периодическая бронь (абонемент)
    is_periodic: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    day_of_week: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)   # 0=Пн … 6=Вс
    valid_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    # Группирует все слоты одного абонемента (отмена всей серии)
    recurring_group_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )

    court: Mapped["Court"] = relationship()
    user: Mapped["User"] = relationship()

    # Partial unique index (WHERE status='active') создан в миграции d2e3f4a5b6c7
    # Здесь не объявляем UniqueConstraint чтобы избежать дублирования
    __table_args__ = ()


class SlotLock(UUIDMixin, Base):
    """7-минутная блокировка ячейки пока пользователь заполняет форму брони (ТЗ стр. 569)."""
    __tablename__ = "slot_locks"

    court_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("courts.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    date: Mapped[date] = mapped_column(Date, index=True)
    slot_start: Mapped[time] = mapped_column(Time)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)

    court: Mapped["Court"] = relationship()
    user: Mapped["User"] = relationship()

    __table_args__ = (
        UniqueConstraint("court_id", "date", "slot_start", name="uq_slot_lock"),
    )


from app.models.location import Court  # noqa: E402
from app.models.user import User  # noqa: E402
