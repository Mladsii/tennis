import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, SmallInteger, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class SearchRequest(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "search_requests"

    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    game_type: Mapped[str] = mapped_column(String(10), index=True)
    stm_level: Mapped[str | None] = mapped_column(String(3))
    stm_min: Mapped[str | None] = mapped_column(String(3))
    stm_max: Mapped[str | None] = mapped_column(String(3))
    gender_filter: Mapped[str | None] = mapped_column(String(1))  # "M" | "F" | None = любой
    court_booked: Mapped[bool] = mapped_column(Boolean, default=False)
    location_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("locations.id"), index=True
    )
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    only_preferred: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    open_date: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    max_players: Mapped[int] = mapped_column(SmallInteger, default=1)
    confirmed_count: Mapped[int] = mapped_column(SmallInteger, default=0)

    # ТЗ: привязка к брони корта (когда court_booked=True)
    booking_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("court_bookings.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    author: Mapped["User"] = relationship()
    location: Mapped["Location | None"] = relationship()
    booking: Mapped["CourtBooking | None"] = relationship()
    responses: Mapped[list["SearchResponse"]] = relationship(
        back_populates="search_request", cascade="all, delete-orphan"
    )


class SearchResponse(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "search_responses"
    __table_args__ = (
        UniqueConstraint("search_request_id", "responder_id", name="uq_search_responder"),
    )

    search_request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("search_requests.id", ondelete="CASCADE"),
        index=True,
    )
    responder_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[str] = mapped_column(String(10), default="pending", index=True)
    decline_reason: Mapped[str | None] = mapped_column(Text)

    search_request: Mapped["SearchRequest"] = relationship(back_populates="responses")
    responder: Mapped["User"] = relationship()


from app.models.booking import CourtBooking  # noqa: E402
from app.models.location import Location  # noqa: E402
from app.models.user import User  # noqa: E402
