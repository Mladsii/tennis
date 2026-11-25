import uuid
from datetime import date, time

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, Time
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class WaitingQueue(UUIDMixin, TimestampMixin, Base):
    """Очередь ожидания на корт.

    Пользователь встаёт в очередь на ИНТЕРВАЛ (slot_start..slot_end) с минимальной
    длительностью min_duration (минуты). Уведомляем, когда внутри интервала
    собирается непрерывное свободное окно >= min_duration.

    any_court=True + location_id → следим за всеми кортами локации.
    any_court=False → следим только за указанным court_id.
    accept_partial=True → уведомить и о меньшем окне (< min_duration).
    """
    __tablename__ = "waiting_queue"

    court_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("courts.id", ondelete="CASCADE"), index=True
    )
    location_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("locations.id", ondelete="CASCADE"), index=True, nullable=True
    )
    any_court: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    date: Mapped[date] = mapped_column(Date, index=True)
    slot_start: Mapped[time] = mapped_column(Time)
    # Конец желаемого интервала; для старых записей = slot_start + 30 мин
    slot_end: Mapped[time | None] = mapped_column(Time, nullable=True)
    # Минимальная длительность игры в минутах (по умолчанию час)
    min_duration: Mapped[int] = mapped_column(Integer, default=60, server_default="60")
    # Уведомлять даже если собралось окно меньше min_duration
    accept_partial: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    # "waiting" | "notified" | "booked" | "cancelled"
    status: Mapped[str] = mapped_column(String(15), default="waiting", index=True)

    court: Mapped["Court"] = relationship()
    location: Mapped["Location | None"] = relationship()
    user: Mapped["User"] = relationship()


from app.models.location import Court, Location  # noqa: E402
from app.models.user import User  # noqa: E402
