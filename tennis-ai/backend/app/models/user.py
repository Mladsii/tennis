import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, SmallInteger, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class User(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "users"

    last_name: Mapped[str] = mapped_column(String(100))
    first_name: Mapped[str] = mapped_column(String(100))
    patronymic: Mapped[str | None] = mapped_column(String(100))
    date_of_birth: Mapped[date] = mapped_column(Date)
    gender: Mapped[str] = mapped_column(String(1))  # 'M' or 'F'
    photo_url: Mapped[str | None] = mapped_column(String(500))
    nickname: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    phone_primary: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    phone_secondary: Mapped[str | None] = mapped_column(String(20))
    address: Mapped[str | None] = mapped_column(Text)
    city: Mapped[str | None] = mapped_column(String(100), index=True)
    years_playing: Mapped[int] = mapped_column(SmallInteger, default=0)
    ntrp_level: Mapped[str] = mapped_column(String(5))
    stm_level: Mapped[str] = mapped_column(String(3), index=True)
    password_hash: Mapped[str] = mapped_column(String(255))

    # Settings
    is_active_search: Mapped[bool] = mapped_column(Boolean, default=True)
    accept_other_requests: Mapped[bool] = mapped_column(Boolean, default=True)
    sound_on_search: Mapped[bool] = mapped_column(Boolean, default=True)
    sound_on_booking: Mapped[bool] = mapped_column(Boolean, default=True)
    sound_on_player_request: Mapped[bool] = mapped_column(Boolean, default=True)

    # Filters for incoming requests
    filter_gender: Mapped[str | None] = mapped_column(String(1))
    filter_stm_min: Mapped[int | None] = mapped_column(SmallInteger)
    filter_stm_max: Mapped[int | None] = mapped_column(SmallInteger)
    filter_game_type: Mapped[str | None] = mapped_column(String(10))
    filter_age_min: Mapped[int | None] = mapped_column(SmallInteger)
    filter_age_max: Mapped[int | None] = mapped_column(SmallInteger)

    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)

    elo_rating: Mapped[int] = mapped_column(SmallInteger, default=1500, index=True)

    # Premium subscription
    is_premium: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    premium_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Trainer role
    # 'none' | 'pending' | 'approved' | 'rejected'
    trainer_status: Mapped[str] = mapped_column(String(10), default="none", index=True)
    trainer_skills: Mapped[str | None] = mapped_column(Text)
    trainer_education: Mapped[str | None] = mapped_column(Text)
    trainer_achievements: Mapped[str | None] = mapped_column(Text)
    trainer_individual: Mapped[bool] = mapped_column(Boolean, default=True)
    trainer_group: Mapped[bool] = mapped_column(Boolean, default=False)
    trainer_kids: Mapped[bool] = mapped_column(Boolean, default=False)
    trainer_disabled: Mapped[bool] = mapped_column(Boolean, default=False)

    # Relationships
    preferred_locations: Mapped[list["UserPreferredLocation"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    preferred_players: Mapped[list["UserPreferredPlayer"]] = relationship(
        back_populates="user",
        foreign_keys="UserPreferredPlayer.user_id",
        cascade="all, delete-orphan",
    )
    device_tokens: Mapped[list["DeviceToken"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class UserPreferredLocation(UUIDMixin, Base):
    __tablename__ = "user_preferred_locations"
    __table_args__ = (
        UniqueConstraint("user_id", "location_id", name="uq_user_location"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    location_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("locations.id", ondelete="CASCADE")
    )
    use_in_search: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="preferred_locations")
    location: Mapped["Location"] = relationship()


class UserPreferredPlayer(UUIDMixin, Base):
    __tablename__ = "user_preferred_players"
    __table_args__ = (
        UniqueConstraint("user_id", "player_id", name="uq_user_player"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    player_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship(
        back_populates="preferred_players", foreign_keys=[user_id]
    )
    player: Mapped["User"] = relationship(foreign_keys=[player_id])


class DeviceToken(UUIDMixin, Base):
    __tablename__ = "device_tokens"
    __table_args__ = (
        UniqueConstraint("user_id", "token", name="uq_user_device_token"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    token: Mapped[str] = mapped_column(String(500))
    platform: Mapped[str] = mapped_column(String(10))  # 'ios' or 'android'
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="device_tokens")


# Forward reference for Location
from app.models.location import Location  # noqa: E402
