import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class CashSession(UUIDMixin, TimestampMixin, Base):
    """Рабочая смена кассира."""
    __tablename__ = "cash_sessions"

    opened_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # "open" | "closed"
    status: Mapped[str] = mapped_column(String(10), default="open", index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    opened_by: Mapped["User"] = relationship(foreign_keys=[opened_by_id])
    transactions: Mapped[list["CashTransaction"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )


class CashTransaction(UUIDMixin, TimestampMixin, Base):
    """Одна операция оплаты в рамках смены."""
    __tablename__ = "cash_transactions"

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cash_sessions.id", ondelete="CASCADE"), index=True
    )
    booking_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("court_bookings.id", ondelete="SET NULL"),
        nullable=True, index=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    amount: Mapped[float] = mapped_column(Numeric(10, 2))
    # "cash" | "card" | "sbp" | "subscription"
    payment_type: Mapped[str] = mapped_column(String(20), index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    # "completed" | "refunded"
    status: Mapped[str] = mapped_column(String(15), default="completed", index=True)

    session: Mapped["CashSession"] = relationship(back_populates="transactions")
    user: Mapped["User | None"] = relationship(foreign_keys=[user_id])
    created_by: Mapped["User | None"] = relationship(foreign_keys=[created_by_id])


from app.models.user import User  # noqa: E402
