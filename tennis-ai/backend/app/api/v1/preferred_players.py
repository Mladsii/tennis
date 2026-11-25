import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from sqlalchemy import func

from app.api.deps import get_current_user
from app.database import get_db
from app.models.user import User, UserPreferredPlayer
from app.schemas.player_request import PreferredPlayerResponse, PreferredPlayerUpdate
from app.services.premium import check_players_limit

router = APIRouter(prefix="/users/me/preferred-players", tags=["preferred-players"])


@router.get("", response_model=list[PreferredPlayerResponse])
async def list_preferred_players(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserPreferredPlayer)
        .where(UserPreferredPlayer.user_id == current_user.id)
        .options(selectinload(UserPreferredPlayer.player))
    )
    return list(result.scalars().all())


@router.put("/{pref_id}", response_model=PreferredPlayerResponse)
async def update_preferred_player(
    pref_id: uuid.UUID,
    data: PreferredPlayerUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserPreferredPlayer)
        .where(
            UserPreferredPlayer.id == pref_id,
            UserPreferredPlayer.user_id == current_user.id,
        )
        .options(selectinload(UserPreferredPlayer.player))
    )
    pref = result.scalar_one_or_none()
    if pref is None:
        raise HTTPException(status_code=404, detail="Preferred player not found")
    pref.is_active = data.is_active
    await db.commit()
    await db.refresh(pref)
    return pref


@router.delete("/{pref_id}", status_code=204)
async def remove_preferred_player(
    pref_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserPreferredPlayer).where(
            UserPreferredPlayer.id == pref_id,
            UserPreferredPlayer.user_id == current_user.id,
        )
    )
    pref = result.scalar_one_or_none()
    if pref is None:
        raise HTTPException(status_code=404, detail="Preferred player not found")
    await db.delete(pref)
    await db.commit()


class AddByIdPayload(BaseModel):
    user_id: uuid.UUID


@router.post("/by-id", response_model=PreferredPlayerResponse, status_code=201)
async def add_preferred_player_by_id(
    payload: AddByIdPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Добавить игрока в список по UUID (из QR-кода)."""
    if payload.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Нельзя добавить себя")

    # Проверяем что пользователь существует
    target = await db.get(User, payload.user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    # Проверяем лимит для бесплатных пользователей
    count_result = await db.execute(
        select(func.count()).select_from(UserPreferredPlayer).where(
            UserPreferredPlayer.user_id == current_user.id,
        )
    )
    current_count = count_result.scalar_one()
    check_players_limit(current_user, current_count)

    # Проверяем что ещё не добавлен
    existing = await db.execute(
        select(UserPreferredPlayer).where(
            UserPreferredPlayer.user_id == current_user.id,
            UserPreferredPlayer.player_id == payload.user_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Игрок уже в вашем списке")

    pref = UserPreferredPlayer(user_id=current_user.id, player_id=payload.user_id)
    db.add(pref)
    await db.commit()
    result = await db.execute(
        select(UserPreferredPlayer)
        .where(UserPreferredPlayer.id == pref.id)
        .options(selectinload(UserPreferredPlayer.player))
    )
    return result.scalar_one()
