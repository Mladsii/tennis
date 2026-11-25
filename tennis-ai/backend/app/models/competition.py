import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, Numeric, SmallInteger, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class Competition(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "competitions"

    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    organizer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    start_date: Mapped[date] = mapped_column(Date, index=True)
    end_date: Mapped[date] = mapped_column(Date)
    location: Mapped[str | None] = mapped_column(String(300))

    # 'open' | 'closed' | 'finished'
    status: Mapped[str] = mapped_column(String(10), default="open", index=True)

    organizer: Mapped["User"] = relationship(foreign_keys=[organizer_id])
    groups: Mapped[list["CompetitionGroup"]] = relationship(
        back_populates="competition", cascade="all, delete-orphan"
    )


class CompetitionGroup(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "competition_groups"

    competition_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("competitions.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(150))    # e.g. "СТМ 3.0–4.5, 18–30 лет"

    age_from: Mapped[int | None] = mapped_column(SmallInteger)
    age_to: Mapped[int | None] = mapped_column(SmallInteger)
    stm_from: Mapped[float | None] = mapped_column(Numeric(3, 1))
    stm_to: Mapped[float | None] = mapped_column(Numeric(3, 1))
    max_participants: Mapped[int | None] = mapped_column(SmallInteger)

    competition: Mapped["Competition"] = relationship(back_populates="groups")
    participants: Mapped[list["CompetitionParticipant"]] = relationship(
        back_populates="group", cascade="all, delete-orphan"
    )


class CompetitionParticipant(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "competition_participants"

    competition_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("competitions.id", ondelete="CASCADE"), index=True
    )
    group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("competition_groups.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    # 'registered' | 'cancelled'
    status: Mapped[str] = mapped_column(String(15), default="registered", index=True)

    user: Mapped["User"] = relationship()
    group: Mapped["CompetitionGroup"] = relationship(back_populates="participants")

    __table_args__ = (
        UniqueConstraint("group_id", "user_id", name="uq_competition_group_user"),
    )


from app.models.user import User  # noqa: E402
