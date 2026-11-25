"""ЮКасса payments API."""
import uuid
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.config import settings
from app.database import get_db
from app.models.user import User
from app.services.premium import is_premium_active

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/payments", tags=["payments"])

# ---------------------------------------------------------------------------
# DEV-only: ручная активация / деактивация Premium без реальной оплаты
# Удалить перед выходом в прод!
# ---------------------------------------------------------------------------


class PaymentCreateResponse(BaseModel):
    payment_id: str
    confirmation_url: str
    amount: str
    currency: str = "RUB"


class PremiumStatusResponse(BaseModel):
    is_premium: bool
    expires_at: datetime | None
    days_left: int | None


def _get_yookassa():
    """Lazy-init ЮКасса конфигурации."""
    try:
        from yookassa import Configuration, Payment
        Configuration.configure(
            settings.YOOKASSA_SHOP_ID,
            settings.YOOKASSA_SECRET_KEY,
        )
        return Payment
    except Exception as e:
        logger.error(f"YooKassa init error: {e}")
        raise HTTPException(status_code=503, detail="Платёжный сервис недоступен")


@router.post("/create-subscription", response_model=PaymentCreateResponse)
async def create_subscription_payment(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Создать платёж ЮКасса для оформления Premium на 1 месяц."""
    Payment = _get_yookassa()

    idempotency_key = str(uuid.uuid4())
    try:
        payment = Payment.create(
            {
                "amount": {
                    "value": settings.PREMIUM_PRICE_RUB,
                    "currency": "RUB",
                },
                "confirmation": {
                    "type": "redirect",
                    "return_url": settings.YOOKASSA_RETURN_URL,
                },
                "capture": True,
                "description": f"TennisAI Premium — {settings.PREMIUM_MONTHS} мес. (@{current_user.nickname})",
                "metadata": {
                    "user_id": str(current_user.id),
                    "months": str(settings.PREMIUM_MONTHS),
                },
            },
            idempotency_key,
        )
    except Exception as e:
        logger.error(f"YooKassa payment create error: {e}")
        raise HTTPException(status_code=502, detail=f"Ошибка создания платежа: {e}")

    return PaymentCreateResponse(
        payment_id=payment.id,
        confirmation_url=payment.confirmation.confirmation_url,
        amount=settings.PREMIUM_PRICE_RUB,
    )


@router.get("/status", response_model=PremiumStatusResponse)
async def get_premium_status(
    current_user: User = Depends(get_current_user),
):
    """Текущий статус Premium-подписки."""
    active = is_premium_active(current_user)
    days_left = None
    if active and current_user.premium_expires_at:
        delta = current_user.premium_expires_at - datetime.now(timezone.utc)
        days_left = max(0, delta.days)

    return PremiumStatusResponse(
        is_premium=active,
        expires_at=current_user.premium_expires_at,
        days_left=days_left,
    )


@router.post("/webhook")
async def yookassa_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Webhook от ЮКасса.
    Вызывается при успешной оплате → активируем Premium.
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event = body.get("event")
    obj = body.get("object", {})

    logger.info(f"YooKassa webhook: event={event}, payment_id={obj.get('id')}")

    if event != "payment.succeeded":
        return {"status": "ignored"}

    # Проверяем статус платежа
    if obj.get("status") != "succeeded":
        return {"status": "ignored"}

    # Получаем user_id из metadata
    metadata = obj.get("metadata", {})
    user_id_str = metadata.get("user_id")
    months = int(metadata.get("months", 1))

    if not user_id_str:
        logger.error("YooKassa webhook: no user_id in metadata")
        return {"status": "error", "detail": "no user_id"}

    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        logger.error(f"YooKassa webhook: invalid user_id {user_id_str}")
        return {"status": "error", "detail": "invalid user_id"}

    # Активируем Premium
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        logger.error(f"YooKassa webhook: user {user_id} not found")
        return {"status": "error", "detail": "user not found"}

    now = datetime.now(timezone.utc)
    # Если подписка ещё активна — продлеваем от текущей даты истечения
    base = user.premium_expires_at if (user.premium_expires_at and user.premium_expires_at > now) else now
    user.is_premium = True
    user.premium_expires_at = base + timedelta(days=30 * months)
    await db.commit()

    logger.info(f"Premium activated for user {user.nickname} until {user.premium_expires_at}")

    # Уведомление пользователю
    try:
        from app.services.notification import create_notification
        await create_notification(
            db=db,
            user_id=user_id,
            type="premium",
            title="🌟 Premium активирован!",
            body=f"Подписка действует до {user.premium_expires_at.strftime('%d.%m.%Y')}",
        )
        await db.commit()
    except Exception:
        pass

    return {"status": "ok"}


# ---------------------------------------------------------------------------
# DEV эндпоинты
# ---------------------------------------------------------------------------

@router.post("/dev/activate", tags=["dev"])
async def dev_activate_premium(
    months: int = 1,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """DEV: активировать Premium текущему пользователю без оплаты."""
    now = datetime.now(timezone.utc)
    base = (
        current_user.premium_expires_at
        if (current_user.premium_expires_at and current_user.premium_expires_at > now)
        else now
    )
    current_user.is_premium = True
    current_user.premium_expires_at = base + timedelta(days=30 * months)
    await db.commit()
    return {
        "status": "ok",
        "is_premium": True,
        "expires_at": current_user.premium_expires_at.isoformat(),
    }


@router.post("/dev/deactivate", tags=["dev"])
async def dev_deactivate_premium(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """DEV: снять Premium с текущего пользователя."""
    current_user.is_premium = False
    current_user.premium_expires_at = None
    await db.commit()
    return {"status": "ok", "is_premium": False}
