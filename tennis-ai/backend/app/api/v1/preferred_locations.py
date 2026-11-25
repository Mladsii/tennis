import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.database import get_db
from app.models.user import User, UserPreferredLocation
from app.schemas.location import PreferredLocationCreate, PreferredLocationResponse, PreferredLocationUpdate

router = APIRouter(prefix="/users/me/preferred-locations", tags=["preferred-locations"])


@router.get("", response_model=list[PreferredLocationResponse])
async def list_preferred_locations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserPreferredLocation)
        .where(UserPreferredLocation.user_id == current_user.id)
        .options(selectinload(UserPreferredLocation.location))
    )
    return list(result.scalars().all())


@router.post("", response_model=PreferredLocationResponse, status_code=201)
async def add_preferred_location(
    data: PreferredLocationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pref = UserPreferredLocation(
        user_id=current_user.id,
        location_id=data.location_id,
        use_in_search=data.use_in_search,
    )
    db.add(pref)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Location already in preferred list")
    await db.refresh(pref)
    result = await db.execute(
        select(UserPreferredLocation)
        .where(UserPreferredLocation.id == pref.id)
        .options(selectinload(UserPreferredLocation.location))
    )
    return result.scalar_one()


@router.put("/{pref_id}", response_model=PreferredLocationResponse)
async def update_preferred_location(
    pref_id: uuid.UUID,
    data: PreferredLocationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserPreferredLocation)
        .where(
            UserPreferredLocation.id == pref_id,
            UserPreferredLocation.user_id == current_user.id,
        )
        .options(selectinload(UserPreferredLocation.location))
    )
    pref = result.scalar_one_or_none()
    if pref is None:
        raise HTTPException(status_code=404, detail="Preferred location not found")
    pref.use_in_search = data.use_in_search
    await db.commit()
    await db.refresh(pref)
    return pref


@router.delete("/{pref_id}", status_code=204)
async def remove_preferred_location(
    pref_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserPreferredLocation).where(
            UserPreferredLocation.id == pref_id,
            UserPreferredLocation.user_id == current_user.id,
        )
    )
    pref = result.scalar_one_or_none()
    if pref is None:
        raise HTTPException(status_code=404, detail="Preferred location not found")
    await db.delete(pref)
    await db.commit()
