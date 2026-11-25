import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class PlayerAddRequest(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "player_add_requests"

    requester_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    target_phone: Mapped[str] = mapped_column(String(20))
    target_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), index=True
    )
    status: Mapped[str] = mapped_column(
        String(10), default="pending", index=True
    )  # pending/accepted/declined

    requester: Mapped["User"] = relationship(foreign_keys=[requester_id])
    target_user: Mapped["User | None"] = relationship(foreign_keys=[target_user_id])


from app.models.user import User  # noqa: E402
