import uuid
from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_admin_user, get_current_user
from app.database import get_db
from app.models.booking import CourtBooking, SlotLock
from app.models.location import Court, Location
from app.models.user import User
from app.schemas.booking import (
    AdminBookingCreate,
    AdminBookingResponse,
    BookingCreate,
    BookingResponse,
    CourtGrid,
    CourtReport,
    DayRevenue,
    LocationGrid,
    SlotInfo,
    SlotLockCreate,
    SlotLockResponse,
)

router = APIRouter(prefix="/bookings", tags=["bookings"])

SLOT_START_HOUR = 8
SLOT_END_HOUR = 22
SLOT_MINUTES = 30
LOCK_MINUTES = 7


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def _generate_slots(date_val: date) -> list[tuple[time, time]]:
    slots = []
    cur = datetime(date_val.year, date_val.month, date_val.day, SLOT_START_HOUR, 0)
    end = datetime(date_val.year, date_val.month, date_val.day, SLOT_END_HOUR, 0)
    while cur < end:
        nxt = cur + timedelta(minutes=SLOT_MINUTES)
        slots.append((cur.time(), nxt.time()))
        cur = nxt
    return slots


def _short_name(user: User) -> str:
    parts = [user.last_name]
    if user.first_name:
        parts.append(user.first_name[0] + ".")
    if user.patronymic:
        parts.append(user.patronymic[0] + ".")
    return " ".join(parts)


def _booking_to_response(
    booking: CourtBooking,
    user: User | None,
    *,
    court_name: str | None = None,
    location_name: str | None = None,
    location_id: str | None = None,
) -> BookingResponse:
    return BookingResponse(
        id=str(booking.id),
        court_id=str(booking.court_id),
        user_id=str(booking.user_id) if booking.user_id else None,
        player_name=_short_name(user) if user else None,
        player_nickname=user.nickname if user else None,
        player_phone=user.phone_primary if user else None,
        date=booking.date.isoformat(),
        slot_start=booking.slot_start.strftime("%H:%M"),
        slot_end=booking.slot_end.strftime("%H:%M"),
        status=booking.status,
        notes=booking.notes,
        payment_status=booking.payment_status,
        is_periodic=booking.is_periodic,
        day_of_week=booking.day_of_week,
        recurring_group_id=str(booking.recurring_group_id) if booking.recurring_group_id else None,
        court_name=court_name,
        location_name=location_name,
        location_id=location_id,
    )


# ─────────────────────────────────────────────────────────────
# Locations list
# ─────────────────────────────────────────────────────────────

@router.get("/locations", response_model=list[dict])
async def list_locations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(Location).where(Location.is_active == True).order_by(Location.name)  # noqa: E712
    )
    locations = res.scalars().all()
    out = []
    for loc in locations:
        courts_res = await db.execute(
            select(Court).where(Court.location_id == loc.id, Court.is_active == True)  # noqa: E712
        )
        court_count = len(courts_res.scalars().all())
        out.append({
            "id": str(loc.id),
            "name": loc.name,
            "address": loc.address,
            "city": loc.city,
            "court_count": court_count,
        })
    return out


# ─────────────────────────────────────────────────────────────
# Grid — шахматка с учётом блокировок
# ─────────────────────────────────────────────────────────────

@router.get("/grid/{location_id}", response_model=LocationGrid)
async def get_location_grid(
    location_id: uuid.UUID,
    date_str: str = Query(..., alias="date"),
    court_type: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        date_val = date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date, use YYYY-MM-DD")

    loc_res = await db.execute(
        select(Location).where(Location.id == location_id, Location.is_active == True)  # noqa: E712
    )
    location = loc_res.scalar_one_or_none()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    courts_query = select(Court).where(Court.location_id == location_id, Court.is_active == True)  # noqa: E712
    if court_type == "singles":
        courts_query = courts_query.where(Court.is_singles_only == True)  # noqa: E712
    elif court_type == "doubles":
        courts_query = courts_query.where(Court.is_doubles_or_singles == True)  # noqa: E712
    courts_res = await db.execute(courts_query)
    courts = list(courts_res.scalars().all())

    court_ids = [c.id for c in courts]
    now = datetime.now(timezone.utc)

    if court_ids:
        bookings_res = await db.execute(
            select(CourtBooking)
            .options(selectinload(CourtBooking.user))
            .where(
                CourtBooking.court_id.in_(court_ids),
                CourtBooking.date == date_val,
                CourtBooking.status == "active",
            )
        )
        bookings = list(bookings_res.scalars().all())

        # Активные блокировки: lazy-cleanup просроченных
        locks_res = await db.execute(
            select(SlotLock).where(
                SlotLock.court_id.in_(court_ids),
                SlotLock.date == date_val,
                SlotLock.expires_at > now,
            )
        )
        locks = list(locks_res.scalars().all())
    else:
        bookings = []
        locks = []

    # Индексы
    booking_index: dict[tuple, CourtBooking] = {}
    for b in bookings:
        booking_index[(b.court_id, b.slot_start.strftime("%H:%M"))] = b

    lock_index: dict[tuple, SlotLock] = {}
    for lk in locks:
        lock_index[(lk.court_id, lk.slot_start.strftime("%H:%M"))] = lk

    is_admin = current_user.is_admin
    all_slots = _generate_slots(date_val)
    court_grids: list[CourtGrid] = []

    for court in courts:
        slots: list[SlotInfo] = []
        for t_start, t_end in all_slots:
            start_str = t_start.strftime("%H:%M")
            end_str = t_end.strftime("%H:%M")
            booking = booking_index.get((court.id, start_str))
            lock = lock_index.get((court.id, start_str))

            if booking is None:
                if lock and lock.user_id != current_user.id:
                    # Заблокировано другим пользователем → красный
                    slots.append(SlotInfo(
                        slot_start=start_str, slot_end=end_str,
                        status="locked",
                        locked_until=lock.expires_at.isoformat(),
                    ))
                else:
                    slots.append(SlotInfo(
                        slot_start=start_str, slot_end=end_str,
                        status="free", booking_id=None,
                    ))
            else:
                user = booking.user
                is_mine = booking.user_id == current_user.id
                is_periodic = booking.is_periodic

                if is_mine:
                    status = "periodic_mine" if is_periodic else "mine"
                elif is_admin:
                    status = "periodic" if is_periodic else "booked"
                else:
                    status = "periodic" if is_periodic else "booked"

                show_details = is_mine or is_admin
                slots.append(SlotInfo(
                    slot_start=start_str, slot_end=end_str,
                    status=status,
                    booking_id=str(booking.id) if show_details else None,
                    player_id=str(user.id) if (show_details and user) else None,
                    player_name=_short_name(user) if (show_details and user) else None,
                    player_nickname=user.nickname if (show_details and user) else None,
                    player_phone=user.phone_primary if (show_details and user) else None,
                    notes=booking.notes if show_details else None,
                    payment_status=booking.payment_status if show_details else None,
                    is_periodic=is_periodic,
                ))

        court_grids.append(CourtGrid(
            court_id=str(court.id),
            court_name=court.name,
            sport=court.sport,
            is_singles_only=court.is_singles_only,
            price_per_slot=float(court.price_per_slot) if court.price_per_slot else None,
            slots=slots,
        ))

    return LocationGrid(
        location_id=str(location_id),
        location_name=location.name,
        date=date_val.isoformat(),
        courts=court_grids,
    )


# ─────────────────────────────────────────────────────────────
# Обычная бронь (мобилка / игрок)
# ─────────────────────────────────────────────────────────────

@router.post("", response_model=BookingResponse, status_code=201)
async def create_booking(
    data: BookingCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    court_res = await db.execute(select(Court).where(Court.id == data.court_id))
    court = court_res.scalar_one_or_none()
    if not court:
        raise HTTPException(status_code=404, detail="Court not found")

    try:
        t_start = time.fromisoformat(data.slot_start)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid slot_start, use HH:MM")

    # Нельзя бронировать прошедшее время
    _local_now = datetime.now()
    if datetime.combine(data.date, t_start) < _local_now:
        raise HTTPException(status_code=400, detail="Это время уже прошло")

    dt_end = datetime.combine(data.date, t_start) + timedelta(minutes=SLOT_MINUTES)
    t_end = dt_end.time()

    # Проверяем активный чужой lock (ТЗ: нельзя бронировать заблокированный слот)
    now = datetime.now(timezone.utc)
    lock_res = await db.execute(
        select(SlotLock).where(
            SlotLock.court_id == data.court_id,
            SlotLock.date == data.date,
            SlotLock.slot_start == t_start,
            SlotLock.expires_at > now,
            SlotLock.user_id != current_user.id,
        )
    )
    if lock_res.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Slot is currently being booked by another user")

    existing_res = await db.execute(
        select(CourtBooking).where(
            CourtBooking.court_id == data.court_id,
            CourtBooking.date == data.date,
            CourtBooking.slot_start == t_start,
            CourtBooking.status == "active",
        )
    )
    if existing_res.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Slot already booked")

    booking = CourtBooking(
        court_id=data.court_id,
        user_id=current_user.id,
        date=data.date,
        slot_start=t_start,
        slot_end=t_end,
    )
    db.add(booking)
    await db.commit()
    await db.refresh(booking)
    return _booking_to_response(booking, current_user)


# ─────────────────────────────────────────────────────────────
# Админская бронь: за любого игрока, диапазон слотов + периодика
# ─────────────────────────────────────────────────────────────

@router.post("/admin", response_model=AdminBookingResponse, status_code=201)
async def admin_create_booking(
    data: AdminBookingCreate,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    court_res = await db.execute(select(Court).where(Court.id == data.court_id))
    court = court_res.scalar_one_or_none()
    if not court:
        raise HTTPException(status_code=404, detail="Court not found")

    # Игрок
    player: User | None = None
    if data.user_id:
        user_res = await db.execute(select(User).where(User.id == data.user_id))
        player = user_res.scalar_one_or_none()
        if not player:
            raise HTTPException(status_code=404, detail="User not found")

    # Валидация периодической брони
    if data.is_periodic:
        if data.day_of_week is None or not (0 <= data.day_of_week <= 6):
            raise HTTPException(status_code=400, detail="day_of_week (0-6) required for periodic booking")
        if not data.valid_until:
            raise HTTPException(status_code=400, detail="valid_until required for periodic booking")
        if data.valid_until <= data.date:
            raise HTTPException(status_code=400, detail="valid_until must be after start date")

    # Определяем набор дат для брони
    if data.is_periodic:
        dates_to_book = _weekly_dates(data.date, data.day_of_week, data.valid_until)  # type: ignore[arg-type]
    else:
        dates_to_book = [data.date]

    recurring_group_id = uuid.uuid4() if data.is_periodic else None

    booked: list[BookingResponse] = []
    failed: list[str] = []
    now = datetime.now(timezone.utc)

    for booking_date in dates_to_book:
        for slot_start_str in data.slot_starts:
            try:
                t_start = time.fromisoformat(slot_start_str)
            except ValueError:
                failed.append(f"{booking_date} {slot_start_str}")
                continue

            dt_end = datetime.combine(booking_date, t_start) + timedelta(minutes=SLOT_MINUTES)
            t_end = dt_end.time()

            # Проверяем чужой lock
            lock_res = await db.execute(
                select(SlotLock).where(
                    SlotLock.court_id == data.court_id,
                    SlotLock.date == booking_date,
                    SlotLock.slot_start == t_start,
                    SlotLock.expires_at > now,
                    SlotLock.user_id != current_user.id,
                )
            )
            if lock_res.scalar_one_or_none():
                failed.append(f"{booking_date} {slot_start_str}")
                continue

            existing_res = await db.execute(
                select(CourtBooking).where(
                    CourtBooking.court_id == data.court_id,
                    CourtBooking.date == booking_date,
                    CourtBooking.slot_start == t_start,
                    CourtBooking.status == "active",
                )
            )
            if existing_res.scalar_one_or_none():
                failed.append(f"{booking_date} {slot_start_str}")
                continue

            booking = CourtBooking(
                court_id=data.court_id,
                user_id=player.id if player else current_user.id,
                date=booking_date,
                slot_start=t_start,
                slot_end=t_end,
                notes=data.notes,
                payment_status=data.payment_status,
                is_periodic=data.is_periodic,
                day_of_week=data.day_of_week,
                valid_until=data.valid_until,
                recurring_group_id=recurring_group_id,
            )
            db.add(booking)
            await db.flush()
            booked.append(_booking_to_response(booking, player or current_user))

    await db.commit()
    return AdminBookingResponse(booked=booked, failed=failed)


def _weekly_dates(start: date, day_of_week: int, valid_until: date) -> list[date]:
    """Все даты weekday=day_of_week от start до valid_until включительно."""
    dates = []
    current = start
    # Сдвигаем к нужному дню недели если start не совпадает
    days_ahead = (day_of_week - current.weekday()) % 7
    current = current + timedelta(days=days_ahead)
    while current <= valid_until:
        dates.append(current)
        current += timedelta(weeks=1)
    return dates


# ─────────────────────────────────────────────────────────────
# Отмена брони (с поддержкой отмены всего абонемента)
# ─────────────────────────────────────────────────────────────

@router.delete("/{booking_id}", status_code=204)
async def cancel_booking(
    booking_id: uuid.UUID,
    cancel_series: bool = Query(False, description="Отменить весь абонемент"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(CourtBooking).where(CourtBooking.id == booking_id))
    booking = res.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if not current_user.is_admin and booking.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your booking")
    if booking.status != "active":
        raise HTTPException(status_code=400, detail="Booking already cancelled")

    # Отменить всю серию абонемента (будущие слоты)
    if cancel_series and booking.recurring_group_id:
        today = date.today()
        series_res = await db.execute(
            select(CourtBooking).where(
                CourtBooking.recurring_group_id == booking.recurring_group_id,
                CourtBooking.status == "active",
                CourtBooking.date >= today,
            )
        )
        series = series_res.scalars().all()
        for b in series:
            b.status = "cancelled"
        await db.commit()

        # Освободились все будущие даты серии — проверить очередь по каждой
        from app.services.queue_notify import notify_queue_for_court

        for d in sorted({b.date for b in series}):
            await notify_queue_for_court(db, booking.court_id, d)
        return

    # Одиночная отмена
    court_id = booking.court_id
    booking_date = booking.date
    slot_start = booking.slot_start
    slot_end = booking.slot_end

    booking.status = "cancelled"
    await db.commit()

    # Проверить очередь: собралось ли у кого-то непрерывное окно >= min_duration
    from app.services.queue_notify import notify_queue_for_court

    await notify_queue_for_court(db, court_id, booking_date)


# ─────────────────────────────────────────────────────────────
# Мои брони
# ─────────────────────────────────────────────────────────────

@router.get("/mine", response_model=list[BookingResponse])
async def get_my_bookings(
    upcoming_only: bool = Query(True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.models.location import Court, Location

    stmt = (
        select(CourtBooking)
        .options(
            selectinload(CourtBooking.user),
            selectinload(CourtBooking.court),
        )
        .where(CourtBooking.user_id == current_user.id, CourtBooking.status == "active")
        .order_by(CourtBooking.date, CourtBooking.slot_start)
    )
    if upcoming_only:
        _now_t = datetime.now().time()
        stmt = stmt.where(
            (CourtBooking.date > date.today())
            | ((CourtBooking.date == date.today()) & (CourtBooking.slot_end > _now_t))
        )
    res = await db.execute(stmt)
    bookings = res.scalars().all()

    # Batch-load locations for all courts
    court_ids = list({b.court_id for b in bookings})
    loc_map: dict = {}
    if court_ids:
        loc_res = await db.execute(
            select(Court, Location)
            .join(Location, Court.location_id == Location.id)
            .where(Court.id.in_(court_ids))
        )
        for court_row, loc_row in loc_res.all():
            loc_map[str(court_row.id)] = (loc_row.name, str(loc_row.id))

    return [
        _booking_to_response(
            b,
            current_user,
            court_name=b.court.name if b.court else None,
            location_name=(loc_map.get(str(b.court_id)) or (None, None))[0],
            location_id=(loc_map.get(str(b.court_id)) or (None, None))[1],
        )
        for b in bookings
    ]


# ─────────────────────────────────────────────────────────────
# Брони конкретного игрока (для карточки)
# ─────────────────────────────────────────────────────────────

@router.get("/player/{user_id}", response_model=list[BookingResponse])
async def get_player_bookings(
    user_id: uuid.UUID,
    upcoming_only: bool = Query(True),
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(CourtBooking)
        .options(selectinload(CourtBooking.user))
        .where(CourtBooking.user_id == user_id, CourtBooking.status == "active")
        .order_by(CourtBooking.date, CourtBooking.slot_start)
    )
    if upcoming_only:
        _now_t = datetime.now().time()
        stmt = stmt.where(
            (CourtBooking.date > date.today())
            | ((CourtBooking.date == date.today()) & (CourtBooking.slot_end > _now_t))
        )
    res = await db.execute(stmt)
    bookings = res.scalars().all()
    user_res = await db.execute(select(User).where(User.id == user_id))
    user = user_res.scalar_one_or_none()
    return [_booking_to_response(b, user) for b in bookings]


# ─────────────────────────────────────────────────────────────
# 7-минутная блокировка ячейки
# ─────────────────────────────────────────────────────────────

@router.post("/lock", response_model=SlotLockResponse, status_code=201)
async def lock_slot(
    data: SlotLockCreate,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Захватить ячейку на 7 минут (ТЗ стр. 569). Если уже есть активный чужой lock → 409."""
    try:
        t_start = time.fromisoformat(data.slot_start)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid slot_start, use HH:MM")

    now = datetime.now(timezone.utc)

    # Проверяем существование корта
    court_check = await db.execute(select(Court).where(Court.id == data.court_id))
    if not court_check.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Court not found")

    # Проверяем существующую бронь
    existing_res = await db.execute(
        select(CourtBooking).where(
            CourtBooking.court_id == data.court_id,
            CourtBooking.date == data.date,
            CourtBooking.slot_start == t_start,
            CourtBooking.status == "active",
        )
    )
    if existing_res.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Slot already booked")

    # Проверяем чужой активный lock
    lock_res = await db.execute(
        select(SlotLock).where(
            SlotLock.court_id == data.court_id,
            SlotLock.date == data.date,
            SlotLock.slot_start == t_start,
            SlotLock.expires_at > now,
        )
    )
    existing_lock = lock_res.scalar_one_or_none()

    if existing_lock:
        if existing_lock.user_id == current_user.id:
            # Продлить свой lock → 200 (не создание, а обновление)
            existing_lock.expires_at = now + timedelta(minutes=LOCK_MINUTES)
            await db.commit()
            await db.refresh(existing_lock)
            response.status_code = 200
            return SlotLockResponse(
                id=str(existing_lock.id),
                court_id=str(existing_lock.court_id),
                user_id=str(existing_lock.user_id),
                date=existing_lock.date.isoformat(),
                slot_start=existing_lock.slot_start.strftime("%H:%M"),
                expires_at=existing_lock.expires_at,
            )
        raise HTTPException(status_code=409, detail="Slot is locked by another user")

    # Удалить просроченные locks на этот слот (lazy cleanup)
    await db.execute(
        select(SlotLock).where(
            SlotLock.court_id == data.court_id,
            SlotLock.date == data.date,
            SlotLock.slot_start == t_start,
        )
    )

    lock = SlotLock(
        court_id=data.court_id,
        user_id=current_user.id,
        date=data.date,
        slot_start=t_start,
        expires_at=now + timedelta(minutes=LOCK_MINUTES),
    )
    db.add(lock)
    await db.commit()
    await db.refresh(lock)

    return SlotLockResponse(
        id=str(lock.id),
        court_id=str(lock.court_id),
        user_id=str(lock.user_id),
        date=lock.date.isoformat(),
        slot_start=lock.slot_start.strftime("%H:%M"),
        expires_at=lock.expires_at,
    )


@router.delete("/lock/{lock_id}", status_code=204)
async def release_lock(
    lock_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Досрочно отпустить lock (при закрытии/сохранении формы)."""
    res = await db.execute(select(SlotLock).where(SlotLock.id == lock_id))
    lock = res.scalar_one_or_none()
    if not lock:
        return  # уже истёк или не существует
    if lock.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not your lock")
    await db.delete(lock)
    await db.commit()


# ─────────────────────────────────────────────────────────────
# Отчёты по выручке / загруженности
# ─────────────────────────────────────────────────────────────

@router.get("/reports", response_model=CourtReport)
async def get_court_report(
    location_id: uuid.UUID,
    date_from: str = Query(...),
    date_to: str = Query(...),
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        d_from = date.fromisoformat(date_from)
        d_to = date.fromisoformat(date_to)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date, use YYYY-MM-DD")

    if d_to < d_from:
        raise HTTPException(status_code=400, detail="date_to must be >= date_from")

    loc_res = await db.execute(select(Location).where(Location.id == location_id))
    location = loc_res.scalar_one_or_none()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    # Получаем все активные корты локации
    courts_res = await db.execute(
        select(Court).where(Court.location_id == location_id, Court.is_active == True)  # noqa: E712
    )
    courts = list(courts_res.scalars().all())
    court_ids = [c.id for c in courts]
    price_map = {c.id: float(c.price_per_slot or 0) for c in courts}

    # Все брони за период
    bookings_res = await db.execute(
        select(CourtBooking).where(
            CourtBooking.court_id.in_(court_ids),
            CourtBooking.date >= d_from,
            CourtBooking.date <= d_to,
            CourtBooking.status == "active",
        )
    )
    bookings = list(bookings_res.scalars().all())

    # Строим по-дневную статистику
    from collections import defaultdict
    day_bookings: dict[date, list[CourtBooking]] = defaultdict(list)
    for b in bookings:
        day_bookings[b.date].append(b)

    # Общее кол-во слотов на один корт за день
    slots_per_court = len(_generate_slots(d_from))
    total_slots_per_day = slots_per_court * len(courts)

    by_day: list[DayRevenue] = []
    current_day = d_from
    while current_day <= d_to:
        day_bks = day_bookings[current_day]
        revenue = sum(price_map.get(b.court_id, 0) for b in day_bks)
        unique_visitors = len({b.user_id for b in day_bks if b.user_id})
        used = len(day_bks)
        free = total_slots_per_day - used
        load_pct = round(used / total_slots_per_day * 100, 1) if total_slots_per_day else 0

        by_day.append(DayRevenue(
            date=current_day.isoformat(),
            revenue=revenue,
            bookings_count=used,
            unique_visitors=unique_visitors,
            used_slots=used,
            free_slots=max(free, 0),
            load_pct=load_pct,
        ))
        current_day += timedelta(days=1)

    total_revenue = sum(d.revenue for d in by_day)
    total_bookings = sum(d.bookings_count for d in by_day)
    total_visitors = len({b.user_id for b in bookings if b.user_id})
    avg_load = round(sum(d.load_pct for d in by_day) / len(by_day), 1) if by_day else 0

    return CourtReport(
        location_id=str(location_id),
        location_name=location.name,
        date_from=date_from,
        date_to=date_to,
        total_revenue=total_revenue,
        total_bookings=total_bookings,
        total_visitors=total_visitors,
        avg_load_pct=avg_load,
        by_day=by_day,
    )
