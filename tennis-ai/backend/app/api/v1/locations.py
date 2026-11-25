import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_admin_user, get_current_user
from app.database import get_db
from app.models.location import Court, Location
from app.models.user import User
from app.schemas.location import (
    CourtCreate,
    CourtResponse,
    CourtUpdate,
    LocationCreate,
    LocationListResponse,
    LocationResponse,
    LocationUpdate,
)

router = APIRouter(prefix="/locations", tags=["locations"])


@router.get("", response_model=list[LocationListResponse])
async def list_locations(
    city: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Location).where(Location.is_active == True)  # noqa: E712
    if city:
        query = query.where(Location.city.ilike(f"%{city}%"))
    result = await db.execute(query.order_by(Location.name))
    return list(result.scalars().all())


@router.get("/{location_id}", response_model=LocationResponse)
async def get_location(
    location_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Location)
        .where(Location.id == location_id)
        .options(selectinload(Location.courts))
    )
    location = result.scalar_one_or_none()
    if location is None:
        raise HTTPException(status_code=404, detail="Location not found")
    return location


@router.post("", response_model=LocationResponse, status_code=201)
async def create_location(
    data: LocationCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    location = Location(**data.model_dump())
    db.add(location)
    await db.commit()
    result = await db.execute(
        select(Location)
        .where(Location.id == location.id)
        .options(selectinload(Location.courts))
    )
    return result.scalar_one()


@router.put("/{location_id}", response_model=LocationResponse)
async def update_location(
    location_id: uuid.UUID,
    data: LocationUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    result = await db.execute(
        select(Location)
        .where(Location.id == location_id)
        .options(selectinload(Location.courts))
    )
    location = result.scalar_one_or_none()
    if location is None:
        raise HTTPException(status_code=404, detail="Location not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(location, key, value)
    await db.commit()
    await db.refresh(location)
    return location


# Courts
@router.get("/{location_id}/courts", response_model=list[CourtResponse])
async def list_courts(
    location_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Court).where(Court.location_id == location_id).order_by(Court.name)
    )
    return list(result.scalars().all())


@router.post("/{location_id}/courts", response_model=CourtResponse, status_code=201)
async def create_court(
    location_id: uuid.UUID,
    data: CourtCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    court = Court(location_id=location_id, **data.model_dump())
    db.add(court)
    await db.commit()
    await db.refresh(court)
    return court


@router.put("/{location_id}/courts/{court_id}", response_model=CourtResponse)
async def update_court(
    location_id: uuid.UUID,
    court_id: uuid.UUID,
    data: CourtUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    result = await db.execute(
        select(Court).where(Court.id == court_id, Court.location_id == location_id)
    )
    court = result.scalar_one_or_none()
    if court is None:
        raise HTTPException(status_code=404, detail="Court not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(court, key, value)
    await db.commit()
    await db.refresh(court)
    return court
