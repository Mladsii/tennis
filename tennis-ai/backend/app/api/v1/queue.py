"""Очередь ожидания на корт."""
import uuid
from datetime import date, time

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_admin_user, get_current_user
from app.database import get_db
from app.models.location import Court
from app.models.queue import WaitingQueue
from app.models.user import User
from app.schemas.queue import QueueEntryCreate, QueueEntryResponse
from app.services.notification import create_notification

router = APIRouter(prefix="/queue", tags=["queue"])


# ─────────────────────────────────────────────────────────────
# Список очереди (admin — все; обычный — только своя)
# ─────────────────────────────────────────────────────────────

@router.get("", response_model=list[QueueEntryResponse])
async def list_queue(
    court_id: uuid.UUID | None = Query(None),
    date_str: str | None = Query(None, alias="date"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = (
        select(WaitingQueue)
        .where(WaitingQueue.status == "waiting")
        .options(selectinload(WaitingQueue.user), selectinload(WaitingQueue.court).selectinload(Court.location), selectinload(WaitingQueue.location))
        .order_by(WaitingQueue.created_at)
    )
    if not current_user.is_admin:
        q = q.where(WaitingQueue.user_id == current_user.id)
    if court_id:
        q = q.where(WaitingQueue.court_id == court_id)
    if date_str:
        try:
            d = date.fromisoformat(date_str)
            q = q.where(WaitingQueue.date == d)
        except ValueError:
            raise HTTPException(status_code=400, detail="Неверный формат даты")
    res = await db.execute(q)
    return [QueueEntryResponse.from_orm_obj(e) for e in res.scalars().all()]


# ─────────────────────────────────────────────────────────────
# Моя очередь (shortcut для текущего пользователя)
# ─────────────────────────────────────────────────────────────

@router.get("/mine", response_model=list[QueueEntryResponse])
async def my_queue(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import datetime as _dt

    _now = _dt.now()
    res = await db.execute(
        select(WaitingQueue)
        .where(
            WaitingQueue.user_id == current_user.id,
            WaitingQueue.status.in_(["waiting", "notified"]),
            # Прошедшие записи не показываем
            (WaitingQueue.date > _now.date())
            | ((WaitingQueue.date == _now.date()) & (WaitingQueue.slot_end > _now.time())),
        )
        .options(selectinload(WaitingQueue.user), selectinload(WaitingQueue.court).selectinload(Court.location), selectinload(WaitingQueue.location))
        .order_by(WaitingQueue.date, WaitingQueue.slot_start)
    )
    return [QueueEntryResponse.from_orm_obj(e) for e in res.scalars().all()]


# ─────────────────────────────────────────────────────────────
# Встать в очередь — доступно всем
# ─────────────────────────────────────────────────────────────

@router.post("", response_model=QueueEntryResponse, status_code=201)
async def add_to_queue(
    data: QueueEntryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        slot = time.fromisoformat(data.slot_start)
    except ValueError:
        raise HTTPException(status_code=400, detail="Неверный формат времени HH:MM")

    # Конец интервала: явно указан или slot_start + 30 мин (старое поведение)
    if data.slot_end:
        try:
            slot_end = time.fromisoformat(data.slot_end)
        except ValueError:
            raise HTTPException(status_code=400, detail="Неверный формат времени HH:MM")
    else:
        end_minutes = slot.hour * 60 + slot.minute + 30
        slot_end = time(end_minutes // 60, end_minutes % 60)

    if slot_end <= slot:
        raise HTTPException(status_code=400, detail="Конец интервала должен быть позже начала")

    # Нельзя вставать в очередь на прошедшее время
    from datetime import datetime as _dt

    if _dt.combine(data.date, slot_end) < _dt.now():
        raise HTTPException(status_code=400, detail="Это время уже прошло")

    interval_minutes = (slot_end.hour * 60 + slot_end.minute) - (slot.hour * 60 + slot.minute)
    if data.min_duration > interval_minutes:
        raise HTTPException(
            status_code=400,
            detail="Минимальная длительность больше самого интервала",
        )

    # Кто встаёт: admin может указать другого, иначе — себя
    if data.user_id and current_user.is_admin:
        target_user_id = data.user_id
    else:
        target_user_id = current_user.id

    # Достаём корт, чтобы узнать location_id
    court_res = await db.execute(select(Court).where(Court.id == data.court_id))
    court = court_res.scalar_one_or_none()
    if not court:
        raise HTTPException(status_code=404, detail="Корт не найден")
    location_id = court.location_id if data.any_court else None

    # Проверить дубликат: пересечение интервалов + либо тот же корт, либо any_court на этой локации
    existing = await db.execute(
        select(WaitingQueue).where(
            WaitingQueue.user_id == target_user_id,
            WaitingQueue.date == data.date,
            WaitingQueue.status == "waiting",
            WaitingQueue.slot_start < slot_end,
            WaitingQueue.slot_end > slot,
            (
                (WaitingQueue.court_id == data.court_id)
                | (WaitingQueue.any_court.is_(True) & (WaitingQueue.location_id == court.location_id))
            ),
        )
    )
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail="Вы уже в очереди на это время")

    entry = WaitingQueue(
        court_id=data.court_id,
        location_id=location_id,
        any_court=data.any_court,
        user_id=target_user_id,
        date=data.date,
        slot_start=slot,
        slot_end=slot_end,
        min_duration=data.min_duration,
        accept_partial=data.accept_partial,
        status="waiting",
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    res = await db.execute(
        select(WaitingQueue)
        .where(WaitingQueue.id == entry.id)
        .options(
            selectinload(WaitingQueue.user),
            selectinload(WaitingQueue.court).selectinload(Court.location),
            selectinload(WaitingQueue.location),
        )
    )
    return QueueEntryResponse.from_orm_obj(res.scalar_one())


# ─────────────────────────────────────────────────────────────
# Выйти из очереди — своя запись
# ─────────────────────────────────────────────────────────────

@router.delete("/{entry_id}", status_code=204)
async def leave_queue(
    entry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    res = await db.execute(select(WaitingQueue).where(WaitingQueue.id == entry_id))
    entry = res.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    if not current_user.is_admin and entry.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Нет доступа")
    entry.status = "cancelled"
    await db.commit()


# ─────────────────────────────────────────────────────────────
# Admin: пометить как уведомлённого вручную
# ─────────────────────────────────────────────────────────────

@router.put("/{entry_id}/notify", response_model=QueueEntryResponse)
async def notify_entry(
    entry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    res = await db.execute(
        select(WaitingQueue)
        .where(WaitingQueue.id == entry_id)
        .options(selectinload(WaitingQueue.user), selectinload(WaitingQueue.court).selectinload(Court.location), selectinload(WaitingQueue.location))
    )
    entry = res.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    entry.status = "notified"
    await db.commit()
    return QueueEntryResponse.from_orm_obj(entry)
