import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel

PAYMENT_STATUSES = ('unpaid', 'cash', 'card', 'sbp')
DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']


class SlotInfo(BaseModel):
    slot_start: str           # "08:00"
    slot_end: str             # "08:30"
    # free | mine | booked | locked | periodic | periodic_mine
    status: str
    booking_id: str | None = None
    # Данные игрока (для занятых слотов)
    player_id: str | None = None
    player_name: str | None = None
    player_nickname: str | None = None
    player_phone: str | None = None
    notes: str | None = None
    payment_status: str | None = None   # для занятых слотов: unpaid/cash/card/sbp
    is_periodic: bool = False
    # Блокировка: expires_at в ISO если слот заблокирован другим пользователем
    locked_until: str | None = None

    model_config = {"from_attributes": True}


class CourtGrid(BaseModel):
    court_id: str
    court_name: str
    sport: str = "tennis"
    is_singles_only: bool = False
    price_per_slot: float | None = None
    slots: list[SlotInfo]


class LocationGrid(BaseModel):
    location_id: str
    location_name: str
    date: str
    courts: list[CourtGrid]


# ── Обычная бронь (игрок) ─────────────────────────────────────

class BookingCreate(BaseModel):
    court_id: uuid.UUID
    date: date
    slot_start: str   # "HH:MM"


# ── Админская бронь ───────────────────────────────────────────

class AdminBookingCreate(BaseModel):
    court_id: uuid.UUID
    date: date
    slot_starts: list[str]               # ["16:00", "16:30"]
    user_id: Optional[uuid.UUID] = None
    notes: Optional[str] = None
    payment_status: str = 'unpaid'       # unpaid | cash | card | sbp
    # Периодическая бронь
    is_periodic: bool = False
    day_of_week: Optional[int] = None    # 0=Пн … 6=Вс
    valid_until: Optional[date] = None   # до какой даты повторять


class BookingResponse(BaseModel):
    id: str
    court_id: str
    user_id: str | None = None
    player_name: str | None = None
    player_nickname: str | None = None
    player_phone: str | None = None
    date: str
    slot_start: str
    slot_end: str
    status: str
    notes: str | None = None
    payment_status: str = 'unpaid'
    is_periodic: bool = False
    day_of_week: int | None = None
    recurring_group_id: str | None = None
    court_name: str | None = None      # populated in /mine for booking picker
    location_name: str | None = None   # populated in /mine for booking picker
    location_id: str | None = None     # populated in /mine for booking picker

    model_config = {"from_attributes": True}


class AdminBookingResponse(BaseModel):
    booked: list[BookingResponse]
    failed: list[str]


# ── Блокировка слота ──────────────────────────────────────────

class SlotLockCreate(BaseModel):
    court_id: uuid.UUID
    date: date
    slot_start: str   # "HH:MM"


class SlotLockResponse(BaseModel):
    id: str
    court_id: str
    user_id: str
    date: str
    slot_start: str
    expires_at: datetime

    model_config = {"from_attributes": True}


# ── Отчёты по выручке / загруженности ────────────────────────

class DayRevenue(BaseModel):
    date: str
    revenue: float          # выручка за день (сумма price_per_slot × брони)
    bookings_count: int     # кол-во броней
    unique_visitors: int    # уникальных игроков
    used_slots: int         # занятых слотов
    free_slots: int         # свободных слотов
    load_pct: float         # загрузка %


class CourtReport(BaseModel):
    location_id: str
    location_name: str
    date_from: str
    date_to: str
    total_revenue: float
    total_bookings: int
    total_visitors: int
    avg_load_pct: float
    by_day: list[DayRevenue]
