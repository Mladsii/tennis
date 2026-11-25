import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, SmallInteger, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class MatchSet(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "match_sets"

    creator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    opponent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    played_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)

    # Set score (games)
    creator_games: Mapped[int] = mapped_column(SmallInteger)
    opponent_games: Mapped[int] = mapped_column(SmallInteger)
    creator_tiebreak: Mapped[int | None] = mapped_column(SmallInteger)
    opponent_tiebreak: Mapped[int | None] = mapped_column(SmallInteger)

    notes: Mapped[str | None] = mapped_column(Text)
    photo_url: Mapped[str | None] = mapped_column(String(500))

    # 'pending' | 'confirmed' | 'declined'
    status: Mapped[str] = mapped_column(String(10), default="pending", index=True)
    decline_reason: Mapped[str | None] = mapped_column(Text)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Elo deltas applied on confirmation (for audit / undo on decline path if needed)
    creator_elo_before: Mapped[int | None] = mapped_column(SmallInteger)
    opponent_elo_before: Mapped[int | None] = mapped_column(SmallInteger)
    creator_elo_change: Mapped[int | None] = mapped_column(SmallInteger)
    opponent_elo_change: Mapped[int | None] = mapped_column(SmallInteger)

    creator: Mapped["User"] = relationship(foreign_keys=[creator_id])
    opponent: Mapped["User"] = relationship(foreign_keys=[opponent_id])


from app.models.user import User  # noqa: E402
