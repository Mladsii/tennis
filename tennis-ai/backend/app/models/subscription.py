import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class SubscriptionPlan(UUIDMixin, TimestampMixin, Base):
    """Тарифный план абонемента (шаблон)."""
    __tablename__ = "subscription_plans"

    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[float] = mapped_column(Numeric(10, 2))
    hours_total: Mapped[int] = mapped_column(Integer)      # кол-во часов в абонементе
    validity_days: Mapped[int] = mapped_column(Integer)    # срок действия в днях
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    subscriptions: Mapped[list["UserSubscription"]] = relationship(back_populates="plan")


class UserSubscription(UUIDMixin, TimestampMixin, Base):
    """Проданный абонемент конкретному игроку."""
    __tablename__ = "user_subscriptions"

    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subscription_plans.id", ondelete="RESTRICT"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    sold_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    hours_remaining: Mapped[float] = mapped_column(Numeric(8, 2))
    purchased_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    # "active" | "expired" | "exhausted" | "cancelled"
    status: Mapped[str] = mapped_column(String(15), default="active", index=True)

    plan: Mapped["SubscriptionPlan"] = relationship(back_populates="subscriptions")
    user: Mapped["User"] = relationship(foreign_keys=[user_id])
    sold_by: Mapped["User | None"] = relationship(foreign_keys=[sold_by_id])


from app.models.user import User  # noqa: E402
