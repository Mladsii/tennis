"""Уведомление очереди при освобождении корта.

Очередь интервальная: пользователь ждёт непрерывное окно >= min_duration
внутри [slot_start, slot_end) на конкретном корте или любом корте локации.
"""
import uuid
from datetime import date as date_type, time

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.booking import CourtBooking
from app.models.location import Court
from app.models.queue import WaitingQueue
from app.services.notification import create_notification

SLOT_MINUTES = 30


def _to_min(t: time) -> int:
    return t.hour * 60 + t.minute


def _to_time(minutes: int) -> time:
    return time(minutes // 60, minutes % 60)


async def _busy_slots(
    db: AsyncSession, court_id: uuid.UUID, day: date_type, lo: int, hi: int
) -> set[int]:
    """Занятые 30-минутные слоты (начала, в минутах) на корте в окне [lo, hi)."""
    res = await db.execute(
        select(CourtBooking.slot_start, CourtBooking.slot_end).where(
            CourtBooking.court_id == court_id,
            CourtBooking.date == day,
            CourtBooking.status == "active",
        )
    )
    busy: set[int] = set()
    for s, e in res.all():
        s_min, e_min = _to_min(s), _to_min(e)
        for m in range(max(s_min, lo), min(e_min, hi), SLOT_MINUTES):
            busy.add(m)
    return busy


def _best_free_window(lo: int, hi: int, busy: set[int]) -> tuple[int, int, int]:
    """Самое длинное непрерывное свободное окно в [lo, hi).

    Возвращает (длина_минут, начало, конец); (0, lo, lo) если всё занято.
    """
    best_len = 0
    best_start = lo
    cur_start: int | None = None
    for m in range(lo, hi, SLOT_MINUTES):
        if m in busy:
            cur_start = None
            continue
        if cur_start is None:
            cur_start = m
        cur_len = m + SLOT_MINUTES - cur_start
        if cur_len > best_len:
            best_len = cur_len
            best_start = cur_start
    return best_len, best_start, best_start + best_len


async def notify_queue_for_court(
    db: AsyncSession, court_id: uuid.UUID, day: date_type
) -> None:
    """После отмены брони: проверить очередь и уведомить первого, чьё окно собралось.

    Смотрим и очередь на конкретный корт, и any_court-очередь на локацию корта.
    """
    court_row = await db.execute(select(Court).where(Court.id == court_id))
    court = court_row.scalar_one_or_none()
    location_id = court.location_id if court else None

    entries_res = await db.execute(
        select(WaitingQueue)
        .where(
            WaitingQueue.date == day,
            WaitingQueue.status == "waiting",
            (
                (WaitingQueue.court_id == court_id)
                | (WaitingQueue.any_court.is_(True) & (WaitingQueue.location_id == location_id))
            ),
        )
        .options(selectinload(WaitingQueue.user))
        .order_by(WaitingQueue.created_at)
    )
    entries = entries_res.scalars().all()
    if not entries:
        return

    # Корты локации — один раз (для any_court-записей)
    location_courts: list[Court] = []
    if location_id:
        lc_res = await db.execute(
            select(Court).where(Court.location_id == location_id, Court.is_active.is_(True))
        )
        location_courts = list(lc_res.scalars().all())

    for entry in entries:
        lo = _to_min(entry.slot_start)
        hi = _to_min(entry.slot_end) if entry.slot_end else lo + SLOT_MINUTES
        need = entry.min_duration or SLOT_MINUTES

        courts_to_check = location_courts if entry.any_court else [
            c for c in location_courts if c.id == entry.court_id
        ]
        if not courts_to_check and court:
            courts_to_check = [court]

        best: tuple[int, int, int, Court] | None = None  # (len, start, end, court)
        for c in courts_to_check:
            busy = await _busy_slots(db, c.id, day, lo, hi)
            win_len, win_start, win_end = _best_free_window(lo, hi, busy)
            if win_len > 0 and (best is None or win_len > best[0]):
                best = (win_len, win_start, win_end, c)

        if best is None:
            continue
        win_len, win_start, win_end, best_court = best

        full = win_len >= need
        if not full and not entry.accept_partial:
            continue  # окно ещё не собралось — ждём дальше

        start_str = _to_time(win_start).strftime("%H:%M")
        end_str = _to_time(win_end).strftime("%H:%M")
        if full:
            title = "Корт освободился!"
            body = f"{best_court.name}: свободно {start_str}–{end_str}. Успейте забронировать!"
        else:
            title = "Освободилось меньше времени"
            body = (
                f"{best_court.name}: свободно только {start_str}–{end_str} "
                f"({win_len} мин). Забронировать?"
            )

        entry.status = "notified"
        await create_notification(
            db,
            user_id=entry.user_id,
            type="court_available",
            title=title,
            body=body,
            reference_type="queue",
            reference_id=entry.id,
        )
        await db.commit()
        return  # уведомляем только первого подходящего
