import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification


async def create_notification(
    db: AsyncSession,
    user_id: uuid.UUID,
    type: str,
    title: str,
    body: str | None = None,
    reference_type: str | None = None,
    reference_id: uuid.UUID | None = None,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        type=type,
        title=title,
        body=body,
        reference_type=reference_type,
        reference_id=reference_id,
    )
    db.add(notification)
    await db.flush()

    # Отправить FCM push (не блокирует если Firebase не настроен).
    # send_push открывает собственную сессию БД — не передаём ему сессию
    # текущего запроса (она может быть уже закрыта к моменту выполнения
    # этой fire-and-forget задачи).
    try:
        from app.services.fcm import send_push
        import asyncio
        asyncio.ensure_future(
            send_push(
                user_id=user_id,
                title=title,
                body=body or '',
                notification_type=type,
                reference_id=str(reference_id) if reference_id else None,
            )
        )
    except Exception:
        pass

    return notification


async def get_user_notifications(
    db: AsyncSession, user_id: uuid.UUID, skip: int = 0, limit: int = 50
) -> list[Notification]:
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all())


async def get_unread_count(db: AsyncSession, user_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == user_id, Notification.is_read == False)  # noqa: E712
    )
    return result.scalar_one()


async def mark_as_read(db: AsyncSession, notification_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id, Notification.user_id == user_id
        )
    )
    notification = result.scalar_one_or_none()
    if notification is None:
        return False
    notification.is_read = True
    await db.flush()
    return True


async def mark_all_as_read(db: AsyncSession, user_id: uuid.UUID) -> int:
    from sqlalchemy import update

    result = await db.execute(
        update(Notification)
        .where(Notification.user_id == user_id, Notification.is_read == False)  # noqa: E712
        .values(is_read=True)
    )
    await db.flush()
    return result.rowcount
