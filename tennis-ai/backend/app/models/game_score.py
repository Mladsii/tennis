import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class GameScore(UUIDMixin, TimestampMixin, Base):
    """Снимок незавершённого гейма: кто подаёт + текущие очки 0/15/30/40/Ad."""

    __tablename__ = "game_scores"

    creator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    opponent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    server_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE")
    )

    played_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)

    # '0' | '15' | '30' | '40' | 'Ad'
    creator_points: Mapped[str] = mapped_column(String(2))
    opponent_points: Mapped[str] = mapped_column(String(2))

    notes: Mapped[str | None] = mapped_column(Text)

    # 'pending' | 'confirmed' | 'declined'
    status: Mapped[str] = mapped_column(String(10), default="pending", index=True)
    decline_reason: Mapped[str | None] = mapped_column(Text)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    creator: Mapped["User"] = relationship(foreign_keys=[creator_id])
    opponent: Mapped["User"] = relationship(foreign_keys=[opponent_id])
    server: Mapped["User"] = relationship(foreign_keys=[server_id])


from app.models.user import User  # noqa: E402
