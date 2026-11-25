import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.database import get_db
from app.models.training import Training, TrainingParticipant
from app.models.user import User
from app.schemas.training import (
    InvitePayload,
    ParticipantStatusUpdate,
    TrainingCreate,
    TrainingListItem,
    TrainingResponse,
)

router = APIRouter(prefix="/trainings", tags=["trainings"])


def _full_query(t_id: uuid.UUID | None = None):
    q = select(Training).options(
        selectinload(Training.organizer),
        selectinload(Training.trainer),
        selectinload(Training.participants).selectinload(TrainingParticipant.user),
    )
    if t_id is not None:
        q = q.where(Training.id == t_id)
    return q


@router.get("", response_model=list[TrainingListItem])
async def my_trainings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Trainings I organize OR I'm invited to."""
    invited_q = select(TrainingParticipant.training_id).where(
        TrainingParticipant.user_id == current_user.id
    )
    res = await db.execute(
        select(Training)
        .where(
            or_(
                Training.organizer_id == current_user.id,
                Training.id.in_(invited_q),
            ),
            Training.status != "cancelled",
        )
        .options(
            selectinload(Training.organizer),
            selectinload(Training.participants),
        )
        .order_by(Training.start_time.desc())
    )
    trainings = list(res.scalars().all())
    out = []
    for t in trainings:
        confirmed = sum(1 for p in t.participants if p.status == "confirmed")
        out.append(TrainingListItem(
            id=t.id,
            title=t.title,
            location=t.location,
            schedule_type=t.schedule_type,
            start_time=t.start_time,
            end_time=t.end_time,
            organizer=t.organizer,
            confirmed_count=confirmed,
        ))
    return out


@router.post("", response_model=TrainingResponse, status_code=201)
async def create_training(
    data: TrainingCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.end_time <= data.start_time:
        raise HTTPException(status_code=400, detail="end_time must be after start_time")
    if data.schedule_type == "weekly" and (not data.weeks_count or data.weeks_count < 1):
        raise HTTPException(status_code=400, detail="weeks_count is required for weekly")

    training = Training(
        organizer_id=current_user.id,
        trainer_id=data.trainer_id,
        title=data.title,
        description=data.description,
        location=data.location,
        schedule_type=data.schedule_type,
        start_time=data.start_time,
        end_time=data.end_time,
        weeks_count=data.weeks_count,
        max_participants=data.max_participants,
        status="active",
    )
    db.add(training)
    await db.flush()

    for uid in data.invite_user_ids:
        if uid == current_user.id:
            continue
        db.add(TrainingParticipant(
            training_id=training.id,
            user_id=uid,
            status="invited",
        ))

    await db.commit()
    res = await db.execute(_full_query(training.id))
    return res.scalar_one()


@router.get("/{t_id}", response_model=TrainingResponse)
async def get_training(
    t_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(_full_query(t_id))
    t = res.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Not found")
    return t


@router.post("/{t_id}/invite", response_model=TrainingResponse)
async def invite_participant(
    t_id: uuid.UUID,
    data: InvitePayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Training).where(Training.id == t_id))
    t = res.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Not found")
    if t.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the organizer can invite")

    existing = await db.execute(
        select(TrainingParticipant).where(
            TrainingParticipant.training_id == t_id,
            TrainingParticipant.user_id == data.user_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Already invited")

    db.add(TrainingParticipant(
        training_id=t_id,
        user_id=data.user_id,
        status="invited",
    ))
    await db.commit()
    res = await db.execute(_full_query(t_id))
    return res.scalar_one()


@router.post("/{t_id}/respond", response_model=TrainingResponse)
async def respond_to_invite(
    t_id: uuid.UUID,
    data: ParticipantStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Confirm/decline/cancel my participation."""
    res = await db.execute(
        select(TrainingParticipant).where(
            TrainingParticipant.training_id == t_id,
            TrainingParticipant.user_id == current_user.id,
        )
    )
    p = res.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="No invite found")
    p.status = data.status
    await db.commit()

    res = await db.execute(_full_query(t_id))
    return res.scalar_one()


@router.post("/{t_id}/cancel", response_model=TrainingResponse)
async def cancel_training(
    t_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Training).where(Training.id == t_id))
    t = res.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Not found")
    if t.organizer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the organizer can cancel")
    t.status = "cancelled"
    await db.commit()
    res = await db.execute(_full_query(t_id))
    return res.scalar_one()
