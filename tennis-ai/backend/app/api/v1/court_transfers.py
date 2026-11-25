import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.database import get_db
from app.models.court_transfer import CourtTransfer, CourtTransferResponse
from app.models.location import Location
from app.models.user import User
from app.schemas.court_transfer import (
    CourtTransferCreate,
    CourtTransferDetail,
    CourtTransferListItem,
    CourtTransferResponseAction,
    CourtTransferResponseOut,
    CourtTransferUpdate,
)
from app.services.notification import create_notification

router = APIRouter(prefix="/court-transfers", tags=["court-transfers"])


@router.post("", response_model=CourtTransferListItem, status_code=201)
async def create_court_transfer(
    data: CourtTransferCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ct = CourtTransfer(author_id=current_user.id, **data.model_dump())
    db.add(ct)
    await db.flush()

    # Notify users who accept other requests
    query = select(User).where(
        User.id != current_user.id,
        User.accept_other_requests == True,  # noqa: E712
    )

    result = await db.execute(query)
    recipients = result.scalars().all()

    loc_result = await db.execute(
        select(Location).where(Location.id == data.location_id)
    )
    loc = loc_result.scalar_one_or_none()
    location_name = loc.name if loc else ""

    for recipient in recipients:
        await create_notification(
            db,
            user_id=recipient.id,
            type="court_transfer",
            title=f"Свободный корт: {location_name}",
            body=(
                f"От: {current_user.last_name} {current_user.first_name[0]}. "
                f"{data.start_time.strftime('%H:%M')}-{data.end_time.strftime('%H:%M')}. "
                f"{'Платно' if data.is_paid else 'Бесплатно'}"
            ),
            reference_type="court_transfer",
            reference_id=ct.id,
        )

    await db.commit()
    result = await db.execute(
        select(CourtTransfer)
        .where(CourtTransfer.id == ct.id)
        .options(selectinload(CourtTransfer.author))
    )
    return result.scalar_one()


@router.get("/mine", response_model=list[CourtTransferListItem])
async def list_my_court_transfers(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CourtTransfer)
        .where(CourtTransfer.author_id == current_user.id)
        .options(selectinload(CourtTransfer.author))
        .order_by(CourtTransfer.created_at.desc())
    )
    return list(result.scalars().all())


@router.get("/available", response_model=list[CourtTransferListItem])
async def list_available_court_transfers(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Active court transfers from other users."""
    result = await db.execute(
        select(CourtTransfer)
        .where(
            CourtTransfer.author_id != current_user.id,
            CourtTransfer.is_active == True,  # noqa: E712
        )
        .options(selectinload(CourtTransfer.author))
        .order_by(CourtTransfer.created_at.desc())
    )
    return list(result.scalars().all())


@router.get("/{ct_id}", response_model=CourtTransferDetail)
async def get_court_transfer(
    ct_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CourtTransfer)
        .where(CourtTransfer.id == ct_id)
        .options(
            selectinload(CourtTransfer.author),
            selectinload(CourtTransfer.responses).selectinload(CourtTransferResponse.responder),
        )
    )
    ct = result.scalar_one_or_none()
    if ct is None:
        raise HTTPException(status_code=404, detail="Court transfer not found")
    return ct


@router.put("/{ct_id}", response_model=CourtTransferDetail)
async def update_court_transfer(
    ct_id: uuid.UUID,
    data: CourtTransferUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CourtTransfer)
        .where(CourtTransfer.id == ct_id, CourtTransfer.author_id == current_user.id)
        .options(
            selectinload(CourtTransfer.author),
            selectinload(CourtTransfer.responses).selectinload(CourtTransferResponse.responder),
        )
    )
    ct = result.scalar_one_or_none()
    if ct is None:
        raise HTTPException(status_code=404, detail="Court transfer not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(ct, key, value)
    await db.commit()
    await db.refresh(ct)
    return ct


@router.delete("/{ct_id}", status_code=204)
async def deactivate_court_transfer(
    ct_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CourtTransfer).where(
            CourtTransfer.id == ct_id, CourtTransfer.author_id == current_user.id
        )
    )
    ct = result.scalar_one_or_none()
    if ct is None:
        raise HTTPException(status_code=404, detail="Court transfer not found")
    ct.is_active = False
    await db.commit()


# --- Responses ---


@router.post("/{ct_id}/respond", response_model=CourtTransferResponseOut, status_code=201)
async def respond_to_court_transfer(
    ct_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CourtTransfer).where(CourtTransfer.id == ct_id)
    )
    ct = result.scalar_one_or_none()
    if ct is None or not ct.is_active:
        raise HTTPException(status_code=404, detail="Court transfer not found or inactive")
    if ct.author_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot respond to your own transfer")

    response = CourtTransferResponse(
        court_transfer_id=ct_id, responder_id=current_user.id
    )
    db.add(response)
    try:
        await db.flush()
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Already responded")

    await create_notification(
        db,
        user_id=ct.author_id,
        type="court_transfer_response",
        title=f"{current_user.last_name} {current_user.first_name[0]}. хочет забронировать корт",
        reference_type="court_transfer",
        reference_id=ct.id,
    )

    await db.commit()
    result = await db.execute(
        select(CourtTransferResponse)
        .where(CourtTransferResponse.id == response.id)
        .options(selectinload(CourtTransferResponse.responder))
    )
    return result.scalar_one()


@router.put("/{ct_id}/responses/{resp_id}/confirm", response_model=CourtTransferResponseOut)
async def confirm_court_response(
    ct_id: uuid.UUID,
    resp_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ct_result = await db.execute(
        select(CourtTransfer).where(
            CourtTransfer.id == ct_id, CourtTransfer.author_id == current_user.id
        )
    )
    ct = ct_result.scalar_one_or_none()
    if ct is None:
        raise HTTPException(status_code=404, detail="Court transfer not found")

    result = await db.execute(
        select(CourtTransferResponse)
        .where(CourtTransferResponse.id == resp_id, CourtTransferResponse.court_transfer_id == ct_id)
        .options(selectinload(CourtTransferResponse.responder))
    )
    resp = result.scalar_one_or_none()
    if resp is None:
        raise HTTPException(status_code=404, detail="Response not found")

    resp.status = "confirmed"
    ct.is_active = False  # Court is taken

    await create_notification(
        db,
        user_id=resp.responder_id,
        type="court_transfer_confirmed",
        title=f"{current_user.last_name} {current_user.first_name[0]}. подтвердил(а) передачу корта",
        reference_type="court_transfer",
        reference_id=ct_id,
    )

    await db.commit()
    await db.refresh(resp)
    return resp


@router.put("/{ct_id}/responses/{resp_id}/decline", response_model=CourtTransferResponseOut)
async def decline_court_response(
    ct_id: uuid.UUID,
    resp_id: uuid.UUID,
    data: CourtTransferResponseAction,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ct_result = await db.execute(
        select(CourtTransfer).where(
            CourtTransfer.id == ct_id, CourtTransfer.author_id == current_user.id
        )
    )
    ct = ct_result.scalar_one_or_none()
    if ct is None:
        raise HTTPException(status_code=404, detail="Court transfer not found")

    result = await db.execute(
        select(CourtTransferResponse)
        .where(CourtTransferResponse.id == resp_id, CourtTransferResponse.court_transfer_id == ct_id)
        .options(selectinload(CourtTransferResponse.responder))
    )
    resp = result.scalar_one_or_none()
    if resp is None:
        raise HTTPException(status_code=404, detail="Response not found")

    resp.status = "declined"
    resp.decline_reason = data.decline_reason

    reason_text = f" Причина: {data.decline_reason}" if data.decline_reason else ""
    await create_notification(
        db,
        user_id=resp.responder_id,
        type="court_transfer_declined",
        title=f"Отказ от {current_user.last_name} {current_user.first_name[0]}.{reason_text}",
        reference_type="court_transfer",
        reference_id=ct_id,
    )

    await db.commit()
    await db.refresh(resp)
    return resp
