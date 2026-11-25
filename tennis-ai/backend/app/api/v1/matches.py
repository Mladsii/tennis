import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.database import get_db
from app.models.match import MatchSet
from app.models.user import User, UserPreferredPlayer
from app.schemas.match import (
    EloPoint,
    MatchSetCreate,
    MatchSetDecline,
    MatchSetResponse,
    MyMatchStats,
    PlayerRanking,
)
from app.services.elo import compute_deltas
from app.services.notification import create_notification

router = APIRouter(prefix="/matches", tags=["matches"])


def _short_name(u: User) -> str:
    initial = u.first_name[0] if u.first_name else ""
    return f"{u.last_name} {initial}.".strip()


def _score_text(ms: MatchSet, swap: bool = False) -> str:
    a, b = ms.creator_games, ms.opponent_games
    ta, tb = ms.creator_tiebreak, ms.opponent_tiebreak
    if swap:
        a, b = b, a
        ta, tb = tb, ta
    base = f"{a}:{b}"
    if ta is not None and tb is not None:
        base += f" ({ta}:{tb})"
    return base


@router.post("/sets", response_model=MatchSetResponse, status_code=201)
async def create_match_set(
    data: MatchSetCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.opponent_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot record a match against yourself")

    opp_result = await db.execute(select(User).where(User.id == data.opponent_id))
    opponent = opp_result.scalar_one_or_none()
    if opponent is None:
        raise HTTPException(status_code=404, detail="Opponent not found")

    ms = MatchSet(creator_id=current_user.id, **data.model_dump())
    db.add(ms)
    await db.flush()

    await create_notification(
        db,
        user_id=opponent.id,
        type="match_set_pending",
        title=f"{_short_name(current_user)} записал(а) счёт сета",
        body=f"{_score_text(ms, swap=True)} — подтвердите или отклоните",
        reference_type="match_set",
        reference_id=ms.id,
    )

    await db.commit()
    result = await db.execute(
        select(MatchSet)
        .where(MatchSet.id == ms.id)
        .options(selectinload(MatchSet.creator), selectinload(MatchSet.opponent))
    )
    return result.scalar_one()


@router.get("/sets/mine", response_model=list[MatchSetResponse])
async def list_my_match_sets(
    status: str | None = Query(None, pattern="^(pending|confirmed|declined)$"),
    role: str | None = Query(None, pattern="^(creator|opponent)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if role == "creator":
        where = MatchSet.creator_id == current_user.id
    elif role == "opponent":
        where = MatchSet.opponent_id == current_user.id
    else:
        where = or_(
            MatchSet.creator_id == current_user.id,
            MatchSet.opponent_id == current_user.id,
        )

    if status is not None:
        where = and_(where, MatchSet.status == status)

    result = await db.execute(
        select(MatchSet)
        .where(where)
        .options(selectinload(MatchSet.creator), selectinload(MatchSet.opponent))
        .order_by(MatchSet.played_at.desc())
    )
    return list(result.scalars().all())


@router.get("/sets/stats", response_model=MyMatchStats)
async def my_match_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    wins_expr = func.sum(
        case(
            (
                and_(
                    MatchSet.creator_id == current_user.id,
                    MatchSet.creator_games > MatchSet.opponent_games,
                ),
                1,
            ),
            (
                and_(
                    MatchSet.opponent_id == current_user.id,
                    MatchSet.opponent_games > MatchSet.creator_games,
                ),
                1,
            ),
            else_=0,
        )
    )
    losses_expr = func.sum(
        case(
            (
                and_(
                    MatchSet.creator_id == current_user.id,
                    MatchSet.creator_games < MatchSet.opponent_games,
                ),
                1,
            ),
            (
                and_(
                    MatchSet.opponent_id == current_user.id,
                    MatchSet.opponent_games < MatchSet.creator_games,
                ),
                1,
            ),
            else_=0,
        )
    )
    res = await db.execute(
        select(wins_expr, losses_expr).where(
            MatchSet.status == "confirmed",
            or_(
                MatchSet.creator_id == current_user.id,
                MatchSet.opponent_id == current_user.id,
            ),
        )
    )
    wins, losses = res.one()

    pending_incoming_res = await db.execute(
        select(func.count())
        .select_from(MatchSet)
        .where(
            MatchSet.opponent_id == current_user.id,
            MatchSet.status == "pending",
        )
    )
    pending_outgoing_res = await db.execute(
        select(func.count())
        .select_from(MatchSet)
        .where(
            MatchSet.creator_id == current_user.id,
            MatchSet.status == "pending",
        )
    )

    return MyMatchStats(
        wins=int(wins or 0),
        losses=int(losses or 0),
        pending_incoming=pending_incoming_res.scalar_one(),
        pending_outgoing=pending_outgoing_res.scalar_one(),
        elo_rating=current_user.elo_rating,
    )


@router.get("/sets/{ms_id}", response_model=MatchSetResponse)
async def get_match_set(
    ms_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(MatchSet)
        .where(MatchSet.id == ms_id)
        .options(selectinload(MatchSet.creator), selectinload(MatchSet.opponent))
    )
    ms = result.scalar_one_or_none()
    if ms is None:
        raise HTTPException(status_code=404, detail="Match set not found")
    if current_user.id not in (ms.creator_id, ms.opponent_id):
        raise HTTPException(status_code=403, detail="Not a participant of this match")
    return ms


@router.post("/sets/{ms_id}/confirm", response_model=MatchSetResponse)
async def confirm_match_set(
    ms_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(MatchSet)
        .where(MatchSet.id == ms_id)
        .options(selectinload(MatchSet.creator), selectinload(MatchSet.opponent))
    )
    ms = result.scalar_one_or_none()
    if ms is None:
        raise HTTPException(status_code=404, detail="Match set not found")
    if ms.opponent_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only opponent can confirm the score")
    if ms.status != "pending":
        raise HTTPException(status_code=400, detail=f"Match is already {ms.status}")

    creator = ms.creator
    opponent = ms.opponent
    creator_won = ms.creator_games > ms.opponent_games

    delta_creator, delta_opponent = compute_deltas(
        creator.elo_rating, opponent.elo_rating, a_won=creator_won
    )

    ms.creator_elo_before = creator.elo_rating
    ms.opponent_elo_before = opponent.elo_rating
    ms.creator_elo_change = delta_creator
    ms.opponent_elo_change = delta_opponent
    creator.elo_rating += delta_creator
    opponent.elo_rating += delta_opponent

    ms.status = "confirmed"
    ms.confirmed_at = datetime.now(timezone.utc)

    sign = "+" if delta_creator >= 0 else ""
    await create_notification(
        db,
        user_id=creator.id,
        type="match_set_confirmed",
        title=f"{_short_name(opponent)} подтвердил(а) счёт",
        body=f"{_score_text(ms)}. Elo: {sign}{delta_creator}",
        reference_type="match_set",
        reference_id=ms.id,
    )

    await db.commit()
    result = await db.execute(
        select(MatchSet)
        .where(MatchSet.id == ms.id)
        .options(selectinload(MatchSet.creator), selectinload(MatchSet.opponent))
    )
    return result.scalar_one()


@router.post("/sets/{ms_id}/decline", response_model=MatchSetResponse)
async def decline_match_set(
    ms_id: uuid.UUID,
    data: MatchSetDecline,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(MatchSet)
        .where(MatchSet.id == ms_id)
        .options(selectinload(MatchSet.creator), selectinload(MatchSet.opponent))
    )
    ms = result.scalar_one_or_none()
    if ms is None:
        raise HTTPException(status_code=404, detail="Match set not found")
    if ms.opponent_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only opponent can decline the score")
    if ms.status != "pending":
        raise HTTPException(status_code=400, detail=f"Match is already {ms.status}")

    ms.status = "declined"
    ms.decline_reason = data.decline_reason

    reason_text = f" Причина: {data.decline_reason}" if data.decline_reason else ""
    await create_notification(
        db,
        user_id=ms.creator_id,
        type="match_set_declined",
        title=f"{_short_name(ms.opponent)} отклонил(а) счёт сета",
        body=f"{_score_text(ms)}.{reason_text}",
        reference_type="match_set",
        reference_id=ms.id,
    )

    await db.commit()
    await db.refresh(ms)
    return ms


@router.delete("/sets/{ms_id}", status_code=204)
async def delete_match_set(
    ms_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(MatchSet).where(MatchSet.id == ms_id))
    ms = result.scalar_one_or_none()
    if ms is None:
        raise HTTPException(status_code=404, detail="Match set not found")
    if ms.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the creator can delete a match set")
    if ms.status == "confirmed":
        raise HTTPException(
            status_code=400,
            detail="Cannot delete a confirmed match — Elo has already been applied",
        )
    await db.delete(ms)
    await db.commit()


# --- Reports ---


@router.get("/rankings/preferred", response_model=list[PlayerRanking])
async def preferred_players_ranking(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Elo ranking among preferred players + the current user."""
    pref_q = select(UserPreferredPlayer.player_id).where(
        UserPreferredPlayer.user_id == current_user.id,
        UserPreferredPlayer.is_active == True,  # noqa: E712
    )
    pref_ids_res = await db.execute(pref_q)
    ids = {row[0] for row in pref_ids_res.all()}
    ids.add(current_user.id)

    users_res = await db.execute(select(User).where(User.id.in_(ids)))
    users = list(users_res.scalars().all())

    win_case = case(
        (
            and_(
                MatchSet.creator_id == User.id,
                MatchSet.creator_games > MatchSet.opponent_games,
            ),
            1,
        ),
        (
            and_(
                MatchSet.opponent_id == User.id,
                MatchSet.opponent_games > MatchSet.creator_games,
            ),
            1,
        ),
        else_=0,
    )
    loss_case = case(
        (
            and_(
                MatchSet.creator_id == User.id,
                MatchSet.creator_games < MatchSet.opponent_games,
            ),
            1,
        ),
        (
            and_(
                MatchSet.opponent_id == User.id,
                MatchSet.opponent_games < MatchSet.creator_games,
            ),
            1,
        ),
        else_=0,
    )

    stats_res = await db.execute(
        select(
            User.id,
            func.coalesce(func.sum(win_case), 0).label("wins"),
            func.coalesce(func.sum(loss_case), 0).label("losses"),
        )
        .join(
            MatchSet,
            and_(
                MatchSet.status == "confirmed",
                or_(MatchSet.creator_id == User.id, MatchSet.opponent_id == User.id),
            ),
            isouter=True,
        )
        .where(User.id.in_(ids))
        .group_by(User.id)
    )
    stats = {row.id: (int(row.wins), int(row.losses)) for row in stats_res.all()}

    rankings = [
        PlayerRanking(
            user=u,
            elo_rating=u.elo_rating,
            wins=stats.get(u.id, (0, 0))[0],
            losses=stats.get(u.id, (0, 0))[1],
        )
        for u in users
    ]
    rankings.sort(key=lambda r: (-r.elo_rating, -r.wins))
    return rankings


@router.get("/elo-history", response_model=list[EloPoint])
async def elo_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(30, le=100),
):
    """Time-series of Elo after each confirmed match (oldest first)."""
    stmt = (
        select(MatchSet)
        .where(
            MatchSet.status == "confirmed",
            or_(
                MatchSet.creator_id == current_user.id,
                MatchSet.opponent_id == current_user.id,
            ),
            or_(
                and_(
                    MatchSet.creator_id == current_user.id,
                    MatchSet.creator_elo_before.isnot(None),
                    MatchSet.creator_elo_change.isnot(None),
                ),
                and_(
                    MatchSet.opponent_id == current_user.id,
                    MatchSet.opponent_elo_before.isnot(None),
                    MatchSet.opponent_elo_change.isnot(None),
                ),
            ),
        )
        .order_by(MatchSet.played_at.asc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    matches = result.scalars().all()

    points: list[EloPoint] = []
    for ms in matches:
        is_creator = ms.creator_id == current_user.id
        elo_before = ms.creator_elo_before if is_creator else ms.opponent_elo_before
        elo_change = ms.creator_elo_change if is_creator else ms.opponent_elo_change
        if elo_before is not None and elo_change is not None:
            date_str = ms.played_at.strftime("%Y-%m-%d")
            points.append(EloPoint(date=date_str, elo=elo_before + elo_change))
    return points
