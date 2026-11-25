import uuid
from datetime import datetime, timezone

from pydantic import BaseModel, Field, model_validator

from app.schemas.user import UserPublicResponse


class SearchRequestCreate(BaseModel):
    game_type: str = Field(pattern="^(singles|doubles|mixed|any)$")
    stm_level: str | None = Field(None, max_length=3)
    stm_min: str | None = Field(None, max_length=3)
    stm_max: str | None = Field(None, max_length=3)
    gender_filter: str | None = Field(None, pattern="^[MF]$")
    court_booked: bool = False
    location_id: uuid.UUID | None = None
    booking_id: uuid.UUID | None = None  # FK → court_bookings.id; заполняется когда court_booked=True
    start_time: datetime
    end_time: datetime
    notes: str | None = None
    only_preferred: bool = True  # ТЗ: по умолчанию ищем только из предпочитаемых
    open_date: bool = False

    @model_validator(mode="after")
    def _validate_times(self):
        # При открытой дате время не учитывается (поля очищаются на клиенте)
        if self.open_date:
            return self
        # Если привязана бронь — start_time/end_time будут перезаписаны на сервере из брони,
        # поэтому полную валидацию пропускаем (клиент мог прислать любые значения).
        if self.booking_id:
            return self
        # Минуты только 00 или 30 (ТЗ: интервал 30 минут)
        for label, dt in (("Время начала", self.start_time), ("Время окончания", self.end_time)):
            if dt.minute not in (0, 30) or dt.second != 0:
                raise ValueError(f"{label}: минуты должны быть 00 или 30")
        if self.end_time <= self.start_time:
            raise ValueError("Время окончания должно быть позже времени начала")
        # Запрет прошедших дат (ТЗ: не допускается установка уже прошедших дат)
        now = datetime.now(timezone.utc)
        start = self.start_time if self.start_time.tzinfo else self.start_time.replace(tzinfo=timezone.utc)
        if start < now:
            raise ValueError("Нельзя создавать поиск на прошедшую дату/время")
        return self


class SearchRequestUpdate(BaseModel):
    game_type: str | None = Field(None, pattern="^(singles|doubles|mixed|any)$")
    stm_level: str | None = None
    stm_min: str | None = None
    stm_max: str | None = None
    gender_filter: str | None = Field(None, pattern="^[MF]$")
    court_booked: bool | None = None
    location_id: uuid.UUID | None = None
    booking_id: uuid.UUID | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    notes: str | None = None
    only_preferred: bool | None = None
    open_date: bool | None = None


class SearchResponseAction(BaseModel):
    decline_reason: str | None = None


class SearchResponseOut(BaseModel):
    id: uuid.UUID
    search_request_id: uuid.UUID
    responder_id: uuid.UUID
    responder: UserPublicResponse
    status: str
    decline_reason: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class SearchRequestResponse(BaseModel):
    id: uuid.UUID
    author_id: uuid.UUID
    author: UserPublicResponse
    game_type: str
    stm_level: str | None
    stm_min: str | None = None
    stm_max: str | None = None
    gender_filter: str | None = None
    court_booked: bool
    location_id: uuid.UUID | None
    booking_id: uuid.UUID | None = None
    # Computed fields (attached in API layer)
    location_name: str | None = None
    court_name: str | None = None
    booking_date: str | None = None
    booking_slot_start: str | None = None
    booking_slot_end: str | None = None
    start_time: datetime
    end_time: datetime
    notes: str | None
    is_active: bool
    only_preferred: bool = False
    open_date: bool = False
    max_players: int
    confirmed_count: int
    created_at: datetime
    responses: list[SearchResponseOut] = []

    model_config = {"from_attributes": True}


class SearchRequestListItem(BaseModel):
    id: uuid.UUID
    author_id: uuid.UUID
    author: UserPublicResponse
    game_type: str
    stm_level: str | None
    stm_min: str | None = None
    stm_max: str | None = None
    gender_filter: str | None = None
    court_booked: bool
    location_id: uuid.UUID | None
    booking_id: uuid.UUID | None = None
    # Computed fields (attached in API layer)
    location_name: str | None = None
    court_name: str | None = None
    booking_date: str | None = None
    booking_slot_start: str | None = None
    booking_slot_end: str | None = None
    start_time: datetime
    end_time: datetime
    is_active: bool
    only_preferred: bool = False
    open_date: bool = False
    max_players: int
    confirmed_count: int
    pending_count: int = 0
    responses_count: int = 0
    has_my_response: bool = False
    my_response_status: str | None = None
    is_expired: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}
