"""Абонементы: тарифные планы и продажа игрокам."""
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_admin_user, get_current_user
from app.database import get_db
from app.models.subscription import SubscriptionPlan, UserSubscription
from app.models.user import User
from app.schemas.subscription import (
    SubscriptionPlanCreate,
    SubscriptionPlanResponse,
    SubscriptionPlanUpdate,
    SubscriptionSell,
    UserSubscriptionResponse,
)

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])

SUB_OPTS = [
    selectinload(UserSubscription.plan),
    selectinload(UserSubscription.user),
    selectinload(UserSubscription.sold_by),
]


# ── Plans ──────────────────────────────────────────────────────────────────────

@router.get("/plans", response_model=list[SubscriptionPlanResponse])
async def list_plans(
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(SubscriptionPlan)
    if not include_inactive:
        q = q.where(SubscriptionPlan.is_active == True)  # noqa: E712
    res = await db.execute(q.order_by(SubscriptionPlan.price))
    return list(res.scalars().all())


@router.post("/plans", response_model=SubscriptionPlanResponse, status_code=201)
async def create_plan(
    data: SubscriptionPlanCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    plan = SubscriptionPlan(**data.model_dump())
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return plan


@router.put("/plans/{plan_id}", response_model=SubscriptionPlanResponse)
async def update_plan(
    plan_id: uuid.UUID,
    data: SubscriptionPlanUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    res = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.id == plan_id))
    plan = res.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="План не найден")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(plan, k, v)
    await db.commit()
    await db.refresh(plan)
    return plan


# ── User subscriptions ─────────────────────────────────────────────────────────

@router.post("/sell", response_model=UserSubscriptionResponse, status_code=201)
async def sell_subscription(
    data: SubscriptionSell,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    res = await db.execute(
        select(SubscriptionPlan).where(SubscriptionPlan.id == data.plan_id)
    )
    plan = res.scalar_one_or_none()
    if not plan or not plan.is_active:
        raise HTTPException(status_code=404, detail="Тарифный план не найден или деактивирован")

    now = datetime.now(timezone.utc)
    sub = UserSubscription(
        plan_id=plan.id,
        user_id=data.user_id,
        sold_by_id=admin.id,
        hours_remaining=plan.hours_total,
        purchased_at=now,
        expires_at=now + timedelta(days=plan.validity_days),
        status="active",
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    res2 = await db.execute(
        select(UserSubscription).where(UserSubscription.id == sub.id).options(*SUB_OPTS)
    )
    return res2.scalar_one()


@router.get("/user/{user_id}", response_model=list[UserSubscriptionResponse])
async def user_subscriptions(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    res = await db.execute(
        select(UserSubscription)
        .where(UserSubscription.user_id == user_id)
        .options(*SUB_OPTS)
        .order_by(UserSubscription.created_at.desc())
    )
    return list(res.scalars().all())


@router.get("/me", response_model=list[UserSubscriptionResponse])
async def my_subscriptions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Для мобильного приложения — абонементы текущего пользователя."""
    res = await db.execute(
        select(UserSubscription)
        .where(
            UserSubscription.user_id == current_user.id,
            UserSubscription.status == "active",
        )
        .options(*SUB_OPTS)
        .order_by(UserSubscription.expires_at)
    )
    return list(res.scalars().all())
