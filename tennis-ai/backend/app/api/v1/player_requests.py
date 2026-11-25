import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.database import get_db
from app.models.player_request import PlayerAddRequest
from app.models.user import User, UserPreferredPlayer
from app.schemas.player_request import PlayerRequestCreate, PlayerRequestResponse
from app.services.notification import create_notification

router = APIRouter(prefix="/player-requests", tags=["player-requests"])


@router.post("", response_model=PlayerRequestResponse, status_code=201)
async def create_player_request(
    data: PlayerRequestCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Find target user: by user_id (from search) or by phone
    target_user = None
    if data.target_user_id:
        res = await db.execute(select(User).where(User.id == data.target_user_id))
        target_user = res.scalar_one_or_none()
    elif data.target_phone:
        res = await db.execute(select(User).where(User.phone_primary == data.target_phone))
        target_user = res.scalar_one_or_none()
    else:
        from fastapi import HTTPException as _HTTP
        raise _HTTP(status_code=400, detail="Укажите target_phone или target_user_id")

    request = PlayerAddRequest(
        requester_id=current_user.id,
        target_phone=target_user.phone_primary if target_user else (data.target_phone or ''),
        target_user_id=target_user.id if target_user else None,
    )
    db.add(request)
    await db.flush()

    if target_user and target_user.accept_other_requests:
        await create_notification(
            db,
            user_id=target_user.id,
            type="player_request",
            title=f"Запрос на добавление: {current_user.last_name} {current_user.first_name}",
            body=f"Телефон: {current_user.phone_primary}",
            reference_type="player_request",
            reference_id=request.id,
        )

    await db.commit()
    result = await db.execute(
        select(PlayerAddRequest)
        .where(PlayerAddRequest.id == request.id)
        .options(
            selectinload(PlayerAddRequest.requester),
            selectinload(PlayerAddRequest.target_user),
        )
    )
    return result.scalar_one()


@router.get("/outgoing", response_model=list[PlayerRequestResponse])
async def list_outgoing_requests(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PlayerAddRequest)
        .where(PlayerAddRequest.requester_id == current_user.id)
        .options(
            selectinload(PlayerAddRequest.requester),
            selectinload(PlayerAddRequest.target_user),
        )
        .order_by(PlayerAddRequest.created_at.desc())
    )
    return list(result.scalars().all())


@router.get("/incoming", response_model=list[PlayerRequestResponse])
async def list_incoming_requests(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PlayerAddRequest)
        .where(
            PlayerAddRequest.target_user_id == current_user.id,
            PlayerAddRequest.status == "pending",
        )
        .options(
            selectinload(PlayerAddRequest.requester),
            selectinload(PlayerAddRequest.target_user),
        )
        .order_by(PlayerAddRequest.created_at.desc())
    )
    return list(result.scalars().all())


@router.put("/{request_id}/accept", response_model=PlayerRequestResponse)
async def accept_player_request(
    request_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PlayerAddRequest)
        .where(
            PlayerAddRequest.id == request_id,
            PlayerAddRequest.target_user_id == current_user.id,
        )
        .options(
            selectinload(PlayerAddRequest.requester),
            selectinload(PlayerAddRequest.target_user),
        )
    )
    request = result.scalar_one_or_none()
    if request is None:
        raise HTTPException(status_code=404, detail="Request not found")
    if request.status != "pending":
        raise HTTPException(status_code=400, detail="Request already processed")

    request.status = "accepted"

    # Add to preferred players (both directions), skip if already exists
    for uid, pid in [
        (request.requester_id, current_user.id),
        (current_user.id, request.requester_id),
    ]:
        exists = await db.execute(
            select(UserPreferredPlayer).where(
                UserPreferredPlayer.user_id == uid,
                UserPreferredPlayer.player_id == pid,
            )
        )
        if not exists.scalar_one_or_none():
            db.add(UserPreferredPlayer(user_id=uid, player_id=pid))

    await create_notification(
        db,
        user_id=request.requester_id,
        type="player_request_accepted",
        title=f"{current_user.last_name} {current_user.first_name} принял(а) запрос",
        reference_type="player_request",
        reference_id=request.id,
    )

    await db.commit()
    await db.refresh(request)
    return request


@router.put("/{request_id}/decline", response_model=PlayerRequestResponse)
async def decline_player_request(
    request_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PlayerAddRequest)
        .where(
            PlayerAddRequest.id == request_id,
            PlayerAddRequest.target_user_id == current_user.id,
        )
        .options(
            selectinload(PlayerAddRequest.requester),
            selectinload(PlayerAddRequest.target_user),
        )
    )
    request = result.scalar_one_or_none()
    if request is None:
        raise HTTPException(status_code=404, detail="Request not found")
    if request.status != "pending":
        raise HTTPException(status_code=400, detail="Request already processed")

    request.status = "declined"
    await db.commit()
    await db.refresh(request)
    return request
