import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    last_name: str = Field(max_length=100)
    first_name: str = Field(max_length=100)
    patronymic: str | None = Field(None, max_length=100)
    date_of_birth: date
    gender: str = Field(pattern="^[MF]$")
    nickname: str = Field(max_length=50)
    phone_primary: str = Field(max_length=20)
    phone_secondary: str | None = Field(None, max_length=20)
    address: str | None = None
    city: str | None = Field(None, max_length=100)
    years_playing: int = Field(ge=0, default=0)
    ntrp_level: str = Field(max_length=5)
    stm_level: str = Field(max_length=3)
    password: str = Field(min_length=6)


class UserUpdate(BaseModel):
    last_name: str | None = Field(None, max_length=100)
    first_name: str | None = Field(None, max_length=100)
    patronymic: str | None = Field(None, max_length=100)
    date_of_birth: date | None = None
    gender: str | None = Field(None, pattern="^[MF]$")
    nickname: str | None = Field(None, max_length=50)
    phone_secondary: str | None = Field(None, max_length=20)
    address: str | None = None
    city: str | None = Field(None, max_length=100)
    years_playing: int | None = Field(None, ge=0)
    ntrp_level: str | None = Field(None, max_length=5)
    stm_level: str | None = Field(None, max_length=3)


class UserResponse(BaseModel):
    id: uuid.UUID
    last_name: str
    first_name: str
    patronymic: str | None
    date_of_birth: date
    gender: str
    photo_url: str | None
    nickname: str
    phone_primary: str
    phone_secondary: str | None
    address: str | None
    city: str | None
    years_playing: int
    ntrp_level: str
    stm_level: str
    is_active_search: bool
    accept_other_requests: bool
    elo_rating: int
    is_admin: bool
    is_premium: bool
    premium_expires_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserPublicResponse(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    patronymic: str | None
    gender: str
    photo_url: str | None
    nickname: str
    years_playing: int
    ntrp_level: str
    stm_level: str
    elo_rating: int

    model_config = {"from_attributes": True}


class UserSettingsUpdate(BaseModel):
    is_active_search: bool | None = None
    accept_other_requests: bool | None = None
    sound_on_search: bool | None = None
    sound_on_booking: bool | None = None
    sound_on_player_request: bool | None = None
    filter_gender: str | None = None
    filter_stm_min: int | None = None
    filter_stm_max: int | None = None
    filter_game_type: str | None = None
    filter_age_min: int | None = None
    filter_age_max: int | None = None


class UserSettingsResponse(BaseModel):
    is_active_search: bool
    accept_other_requests: bool
    sound_on_search: bool
    sound_on_booking: bool
    sound_on_player_request: bool
    filter_gender: str | None
    filter_stm_min: int | None
    filter_stm_max: int | None
    filter_game_type: str | None
    filter_age_min: int | None
    filter_age_max: int | None

    model_config = {"from_attributes": True}
