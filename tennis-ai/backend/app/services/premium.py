"""Premium subscription limits and helpers."""
from datetime import datetime, timezone

from fastapi import HTTPException
from app.models.user import User

# Лимиты для бесплатных пользователей
FREE_LIMITS = {
    "search_requests": 2,        # активных заявок поиска
    "preferred_players": 15,     # предпочитаемых игроков
    "report_days": 7,            # дней в отчётах
    "competitions_organize": 0,  # организовывать соревнования нельзя
}


def is_premium_active(user: User) -> bool:
    """Проверить, активна ли Premium-подписка."""
    if not user.is_premium:
        return False
    if user.premium_expires_at is None:
        return False
    return user.premium_expires_at > datetime.now(timezone.utc)


def check_search_limit(user: User, current_active_count: int) -> None:
    """Выбросить 403 если бесплатный пользователь превысил лимит заявок."""
    if is_premium_active(user):
        return
    if current_active_count >= FREE_LIMITS["search_requests"]:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "PREMIUM_REQUIRED",
                "limit": FREE_LIMITS["search_requests"],
                "message": (
                    f"Бесплатный план позволяет не более "
                    f"{FREE_LIMITS['search_requests']} активных заявок. "
                    f"Оформите Premium для безлимитного поиска."
                ),
            },
        )


def check_players_limit(user: User, current_count: int) -> None:
    """Выбросить 403 если бесплатный пользователь превысил лимит игроков."""
    if is_premium_active(user):
        return
    if current_count >= FREE_LIMITS["preferred_players"]:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "PREMIUM_REQUIRED",
                "limit": FREE_LIMITS["preferred_players"],
                "message": (
                    f"Бесплатный план позволяет не более "
                    f"{FREE_LIMITS['preferred_players']} игроков в списке. "
                    f"Оформите Premium для безлимитного списка."
                ),
            },
        )


def check_organize_competition(user: User) -> None:
    """Только Premium может организовывать соревнования."""
    if is_premium_active(user):
        return
    raise HTTPException(
        status_code=403,
        detail={
            "code": "PREMIUM_REQUIRED",
            "limit": 0,
            "message": "Организация соревнований доступна только с Premium-подпиской.",
        },
    )


def get_report_days(user: User) -> int:
    """Вернуть доступное количество дней для отчётов."""
    if is_premium_active(user):
        return 90
    return FREE_LIMITS["report_days"]
