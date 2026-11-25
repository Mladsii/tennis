import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.models.match import MatchSet
from app.models.user import User, UserPreferredPlayer
from app.services.premium import get_report_days

router = APIRouter(prefix="/reports", tags=["reports"])


class ProgressReport(BaseModel):
    user_id: uuid.UUID
    period_days: int
    matches_total: int
    wins: int
    losses: int
    win_rate: float
    elo_now: int
    elo_change: int


class RankingItem(BaseModel):
    user_id: uuid.UUID
    last_name: str
    first_name: str
    nickname: str
    stm_level: str
    elo_rating: int
    rank: int


@router.get("/me/progress", response_model=ProgressReport)
async def my_progress(
    days: int = Query(7, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Player progress for the last N days: matches, wins, win rate, Elo delta."""
    # Ограничиваем период согласно тарифу
    max_days = get_report_days(current_user)
    days = min(days, max_days)
    since = datetime.now(tz=timezone.utc) - timedelta(days=days)

    res = await db.execute(
        select(MatchSet).where(
            or_(MatchSet.creator_id == current_user.id, MatchSet.opponent_id == current_user.id),
            MatchSet.status == "confirmed",
            MatchSet.confirmed_at >= since,
        )
    )
    matches = list(res.scalars().all())

    wins = 0
    losses = 0
    elo_change = 0
    for m in matches:
        i_am_creator = m.creator_id == current_user.id
        my_games = m.creator_games if i_am_creator else m.opponent_games
        opp_games = m.opponent_games if i_am_creator else m.creator_games
        my_change = m.creator_elo_change if i_am_creator else m.opponent_elo_change
        if my_games > opp_games:
            wins += 1
        else:
            losses += 1
        elo_change += my_change or 0

    total = wins + losses
    win_rate = (wins / total * 100.0) if total else 0.0

    return ProgressReport(
        user_id=current_user.id,
        period_days=days,
        matches_total=total,
        wins=wins,
        losses=losses,
        win_rate=round(win_rate, 1),
        elo_now=current_user.elo_rating,
        elo_change=elo_change,
    )


@router.get("/preferred-rankings", response_model=list[RankingItem])
async def preferred_players_ranking(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Elo ranking of my active preferred players (with myself)."""
    res = await db.execute(
        select(User.id)
        .join(UserPreferredPlayer, UserPreferredPlayer.player_id == User.id)
        .where(
            UserPreferredPlayer.user_id == current_user.id,
            UserPreferredPlayer.is_active == True,  # noqa: E712
        )
    )
    pref_ids = {row[0] for row in res.all()}
    pref_ids.add(current_user.id)

    res = await db.execute(
        select(User).where(User.id.in_(pref_ids)).order_by(User.elo_rating.desc())
    )
    users = list(res.scalars().all())

    out = []
    for i, u in enumerate(users, start=1):
        out.append(RankingItem(
            user_id=u.id,
            last_name=u.last_name,
            first_name=u.first_name,
            nickname=u.nickname,
            stm_level=u.stm_level,
            elo_rating=u.elo_rating,
            rank=i,
        ))
    return out
