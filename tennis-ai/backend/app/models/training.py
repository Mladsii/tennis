import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, SmallInteger, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class Training(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "trainings"

    organizer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    trainer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )

    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(String(300))

    # 'one_time' | 'weekly'
    schedule_type: Mapped[str] = mapped_column(String(10), default="one_time", index=True)

    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    weeks_count: Mapped[int | None] = mapped_column(SmallInteger)  # for weekly

    max_participants: Mapped[int | None] = mapped_column(SmallInteger)

    # 'active' | 'cancelled' | 'finished'
    status: Mapped[str] = mapped_column(String(10), default="active", index=True)

    organizer: Mapped["User"] = relationship(foreign_keys=[organizer_id])
    trainer: Mapped["User"] = relationship(foreign_keys=[trainer_id])
    participants: Mapped[list["TrainingParticipant"]] = relationship(
        back_populates="training", cascade="all, delete-orphan"
    )


class TrainingParticipant(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "training_participants"

    training_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("trainings.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    # 'invited' | 'confirmed' | 'declined' | 'cancelled'
    status: Mapped[str] = mapped_column(String(15), default="invited", index=True)

    training: Mapped["Training"] = relationship(back_populates="participants")
    user: Mapped["User"] = relationship()

    __table_args__ = (
        UniqueConstraint("training_id", "user_id", name="uq_training_user"),
    )


from app.models.user import User  # noqa: E402
