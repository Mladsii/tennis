"""FCM push notification service."""
import uuid
import logging

from sqlalchemy import select

from app.database import async_session
from app.models.user import DeviceToken

logger = logging.getLogger(__name__)

_firebase_app = None


def _get_firebase_app():
    """Lazy-initialize Firebase Admin SDK."""
    global _firebase_app
    if _firebase_app is not None:
        return _firebase_app
    try:
        import firebase_admin
        from firebase_admin import credentials
        import os

        cred_path = os.path.join(os.path.dirname(__file__), '..', '..', 'firebase-credentials.json')
        if not os.path.exists(cred_path):
            logger.warning("firebase-credentials.json not found — FCM disabled")
            return None

        cred = credentials.Certificate(cred_path)
        _firebase_app = firebase_admin.initialize_app(cred)
        logger.info("Firebase Admin SDK initialized")
        return _firebase_app
    except Exception as e:
        logger.warning(f"Firebase init failed: {e}")
        return None


async def send_push(
    user_id: uuid.UUID,
    title: str,
    body: str,
    notification_type: str,
    reference_id: str | None = None,
) -> int:
    """
    Отправить push-уведомление пользователю на все его устройства.
    Возвращает количество успешно отправленных.

    Запускается как fire-and-forget задача (asyncio.ensure_future) уже
    после того, как исходный HTTP-запрос мог завершиться и закрыть свою
    сессию БД — поэтому здесь открывается СОБСТВЕННАЯ короткоживущая
    сессия, а не переиспользуется сессия запроса (иначе конкурентное
    использование одной AsyncSession ломается с ошибкой
    "session is in 'prepared' state").
    """
    app = _get_firebase_app()
    if app is None:
        return 0

    try:
        from firebase_admin import messaging
    except ImportError:
        return 0

    # Получаем все токены пользователя — через свою сессию
    async with async_session() as db:
        result = await db.execute(
            select(DeviceToken).where(DeviceToken.user_id == user_id)
        )
        tokens = [row.token for row in result.scalars().all()]
    if not tokens:
        return 0

    sent = 0
    for token in tokens:
        try:
            message = messaging.Message(
                notification=messaging.Notification(title=title, body=body),
                data={
                    'type': notification_type,
                    'reference_id': reference_id or '',
                },
                token=token,
                android=messaging.AndroidConfig(
                    priority='high',
                    notification=messaging.AndroidNotification(
                        sound='default',
                        channel_id='tennis_ai_default',
                    ),
                ),
            )
            messaging.send(message)
            sent += 1
        except Exception as e:
            logger.warning(f"FCM send failed for token {token[:20]}...: {e}")

    return sent
