import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.database import get_db
from app.models.game_score import GameScore
from app.models.user import User
from app.schemas.game_score import GameScoreCreate, GameScoreDecline, GameScoreResponse

router = APIRouter(prefix="/game-scores", tags=["game-scores"])


def _full_query(gs_id: uuid.UUID | None = None):
    q = select(GameScore).options(
        selectinload(GameScore.creator),
        selectinload(GameScore.opponent),
        selectinload(GameScore.server),
    )
    if gs_id is not None:
        q = q.where(GameScore.id == gs_id)
    return q


@router.get("", response_model=list[GameScoreResponse])
async def my_game_scores(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        _full_query()
        .where(or_(GameScore.creator_id == current_user.id, GameScore.opponent_id == current_user.id))
        .order_by(GameScore.played_at.desc())
    )
    return list(res.scalars().all())


@router.post("", response_model=GameScoreResponse, status_code=201)
async def create_game_score(
    data: GameScoreCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.opponent_id == current_user.id:
        raise HTTPException(status_code=400, detail="Opponent must differ from creator")
    if data.server_id not in (current_user.id, data.opponent_id):
        raise HTTPException(status_code=400, detail="server_id must be creator or opponent")

    gs = GameScore(
        creator_id=current_user.id,
        opponent_id=data.opponent_id,
        server_id=data.server_id,
        played_at=data.played_at,
        creator_points=data.creator_points,
        opponent_points=data.opponent_points,
        notes=data.notes,
        status="pending",
    )
    db.add(gs)
    await db.commit()

    res = await db.execute(_full_query(gs.id))
    return res.scalar_one()


@router.get("/{gs_id}", response_model=GameScoreResponse)
async def get_game_score(
    gs_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(_full_query(gs_id))
    gs = res.scalar_one_or_none()
    if not gs:
        raise HTTPException(status_code=404, detail="Not found")
    if current_user.id not in (gs.creator_id, gs.opponent_id):
        raise HTTPException(status_code=403, detail="Not a participant")
    return gs


@router.post("/{gs_id}/confirm", response_model=GameScoreResponse)
async def confirm_game_score(
    gs_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(GameScore).where(GameScore.id == gs_id))
    gs = res.scalar_one_or_none()
    if not gs:
        raise HTTPException(status_code=404, detail="Not found")
    if gs.opponent_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the opponent can confirm")
    if gs.status != "pending":
        raise HTTPException(status_code=400, detail=f"Already {gs.status}")
    gs.status = "confirmed"
    gs.confirmed_at = datetime.now(tz=timezone.utc)
    await db.commit()

    res = await db.execute(_full_query(gs_id))
    return res.scalar_one()


@router.post("/{gs_id}/decline", response_model=GameScoreResponse)
async def decline_game_score(
    gs_id: uuid.UUID,
    data: GameScoreDecline,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(GameScore).where(GameScore.id == gs_id))
    gs = res.scalar_one_or_none()
    if not gs:
        raise HTTPException(status_code=404, detail="Not found")
    if gs.opponent_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the opponent can decline")
    if gs.status != "pending":
        raise HTTPException(status_code=400, detail=f"Already {gs.status}")
    gs.status = "declined"
    gs.decline_reason = data.reason
    await db.commit()

    res = await db.execute(_full_query(gs_id))
    return res.scalar_one()


@router.delete("/{gs_id}", status_code=204)
async def delete_game_score(
    gs_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(GameScore).where(GameScore.id == gs_id))
    gs = res.scalar_one_or_none()
    if not gs:
        raise HTTPException(status_code=404, detail="Not found")
    if gs.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the creator can delete")
    if gs.status == "confirmed":
        raise HTTPException(status_code=400, detail="Cannot delete confirmed scores")
    await db.delete(gs)
    await db.commit()
