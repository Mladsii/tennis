import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.models.user import User

router = APIRouter(prefix="/trainer-role", tags=["trainer-role"])


class ApplyPayload(BaseModel):
    skills: str
    education: str | None = None
    achievements: str | None = None
    individual: bool = True
    group: bool = False
    kids: bool = False
    disabled: bool = False


class ApplyResponse(BaseModel):
    trainer_status: str


class TrainerApplication(BaseModel):
    user_id: uuid.UUID
    last_name: str
    first_name: str
    nickname: str
    trainer_status: str
    trainer_skills: str | None
    trainer_education: str | None
    trainer_achievements: str | None
    trainer_individual: bool
    trainer_group: bool
    trainer_kids: bool
    trainer_disabled: bool


@router.post("/apply", response_model=ApplyResponse)
async def apply_for_trainer(
    data: ApplyPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """User submits a request to become a trainer."""
    if current_user.trainer_status == "approved":
        raise HTTPException(status_code=400, detail="Already a trainer")
    current_user.trainer_skills = data.skills
    current_user.trainer_education = data.education
    current_user.trainer_achievements = data.achievements
    current_user.trainer_individual = data.individual
    current_user.trainer_group = data.group
    current_user.trainer_kids = data.kids
    current_user.trainer_disabled = data.disabled
    current_user.trainer_status = "pending"
    await db.commit()
    return ApplyResponse(trainer_status=current_user.trainer_status)


@router.get("/me", response_model=TrainerApplication)
async def my_application(
    current_user: User = Depends(get_current_user),
):
    return TrainerApplication(
        user_id=current_user.id,
        last_name=current_user.last_name,
        first_name=current_user.first_name,
        nickname=current_user.nickname,
        trainer_status=current_user.trainer_status,
        trainer_skills=current_user.trainer_skills,
        trainer_education=current_user.trainer_education,
        trainer_achievements=current_user.trainer_achievements,
        trainer_individual=current_user.trainer_individual,
        trainer_group=current_user.trainer_group,
        trainer_kids=current_user.trainer_kids,
        trainer_disabled=current_user.trainer_disabled,
    )


@router.get("/applications", response_model=list[TrainerApplication])
async def list_applications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin only: list all pending trainer applications."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    res = await db.execute(
        select(User).where(User.trainer_status == "pending").order_by(User.last_name)
    )
    users = list(res.scalars().all())
    return [
        TrainerApplication(
            user_id=u.id,
            last_name=u.last_name,
            first_name=u.first_name,
            nickname=u.nickname,
            trainer_status=u.trainer_status,
            trainer_skills=u.trainer_skills,
            trainer_education=u.trainer_education,
            trainer_achievements=u.trainer_achievements,
            trainer_individual=u.trainer_individual,
            trainer_group=u.trainer_group,
            trainer_kids=u.trainer_kids,
            trainer_disabled=u.trainer_disabled,
        )
        for u in users
    ]


@router.post("/{user_id}/approve", response_model=TrainerApplication)
async def approve_trainer(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    res = await db.execute(select(User).where(User.id == user_id))
    u = res.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    u.trainer_status = "approved"
    await db.commit()
    return TrainerApplication(
        user_id=u.id,
        last_name=u.last_name,
        first_name=u.first_name,
        nickname=u.nickname,
        trainer_status=u.trainer_status,
        trainer_skills=u.trainer_skills,
        trainer_education=u.trainer_education,
        trainer_achievements=u.trainer_achievements,
        trainer_individual=u.trainer_individual,
        trainer_group=u.trainer_group,
        trainer_kids=u.trainer_kids,
        trainer_disabled=u.trainer_disabled,
    )


@router.post("/{user_id}/reject", response_model=TrainerApplication)
async def reject_trainer(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    res = await db.execute(select(User).where(User.id == user_id))
    u = res.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    u.trainer_status = "rejected"
    await db.commit()
    return TrainerApplication(
        user_id=u.id,
        last_name=u.last_name,
        first_name=u.first_name,
        nickname=u.nickname,
        trainer_status=u.trainer_status,
        trainer_skills=u.trainer_skills,
        trainer_education=u.trainer_education,
        trainer_achievements=u.trainer_achievements,
        trainer_individual=u.trainer_individual,
        trainer_group=u.trainer_group,
        trainer_kids=u.trainer_kids,
        trainer_disabled=u.trainer_disabled,
    )
