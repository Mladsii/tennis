from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.models.user import DeviceToken, User
from app.schemas.notification import DeviceTokenCreate

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.post("/device-token", status_code=201)
async def register_device_token(
    data: DeviceTokenCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Check if token already exists
    result = await db.execute(
        select(DeviceToken).where(
            DeviceToken.user_id == current_user.id, DeviceToken.token == data.token
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        existing.is_active = True
        existing.platform = data.platform
    else:
        token = DeviceToken(
            user_id=current_user.id,
            token=data.token,
            platform=data.platform,
        )
        db.add(token)
    await db.commit()
    return {"status": "ok"}


@router.delete("/device-token")
async def remove_device_token(
    data: DeviceTokenCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DeviceToken).where(
            DeviceToken.user_id == current_user.id, DeviceToken.token == data.token
        )
    )
    token = result.scalar_one_or_none()
    if token:
        token.is_active = False
        await db.commit()
    return {"status": "ok"}
