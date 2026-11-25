import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class CourtTransfer(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "court_transfers"

    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    location_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("locations.id"), index=True
    )
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    is_paid: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    author: Mapped["User"] = relationship()
    location: Mapped["Location"] = relationship()
    responses: Mapped[list["CourtTransferResponse"]] = relationship(
        back_populates="court_transfer", cascade="all, delete-orphan"
    )


class CourtTransferResponse(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "court_transfer_responses"
    __table_args__ = (
        UniqueConstraint("court_transfer_id", "responder_id", name="uq_court_transfer_responder"),
    )

    court_transfer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("court_transfers.id", ondelete="CASCADE"),
        index=True,
    )
    responder_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[str] = mapped_column(String(10), default="pending", index=True)
    decline_reason: Mapped[str | None] = mapped_column(Text)

    court_transfer: Mapped["CourtTransfer"] = relationship(back_populates="responses")
    responder: Mapped["User"] = relationship()


from app.models.location import Location  # noqa: E402
from app.models.user import User  # noqa: E402
