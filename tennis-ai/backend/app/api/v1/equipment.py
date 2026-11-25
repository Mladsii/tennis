"""Инвентарь клуба: выдача и возврат."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_admin_user, get_current_user
from app.database import get_db
from app.models.equipment import Equipment, EquipmentRental
from app.models.user import User
from app.schemas.equipment import (
    EquipmentCreate,
    EquipmentResponse,
    EquipmentUpdate,
    RentalCreate,
    RentalResponse,
)

router = APIRouter(prefix="/equipment", tags=["equipment"])

RENTAL_OPTS = [
    selectinload(EquipmentRental.equipment),
    selectinload(EquipmentRental.user),
    selectinload(EquipmentRental.created_by),
]


@router.get("", response_model=list[EquipmentResponse])
async def list_equipment(
    location_id: uuid.UUID | None = Query(None),
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Equipment)
    if location_id:
        q = q.where(Equipment.location_id == location_id)
    if not include_inactive:
        q = q.where(Equipment.is_active == True)  # noqa: E712
    res = await db.execute(q.order_by(Equipment.equipment_type, Equipment.name))
    return list(res.scalars().all())


@router.post("", response_model=EquipmentResponse, status_code=201)
async def create_equipment(
    data: EquipmentCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    item = Equipment(
        **data.model_dump(),
        quantity_available=data.quantity_total,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.put("/{item_id}", response_model=EquipmentResponse)
async def update_equipment(
    item_id: uuid.UUID,
    data: EquipmentUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    res = await db.execute(select(Equipment).where(Equipment.id == item_id))
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Инвентарь не найден")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(item, k, v)
    await db.commit()
    await db.refresh(item)
    return item


# ── Rentals ────────────────────────────────────────────────────────────────────

@router.get("/rentals", response_model=list[RentalResponse])
async def list_rentals(
    status: str = "active",
    location_id: uuid.UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    q = (
        select(EquipmentRental)
        .where(EquipmentRental.status == status)
        .options(*RENTAL_OPTS)
        .order_by(EquipmentRental.rented_at.desc())
    )
    if location_id:
        q = q.join(Equipment).where(Equipment.location_id == location_id)
    res = await db.execute(q)
    return list(res.scalars().all())


@router.post("/rentals", response_model=RentalResponse, status_code=201)
async def create_rental(
    data: RentalCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    item_res = await db.execute(select(Equipment).where(Equipment.id == data.equipment_id))
    item = item_res.scalar_one_or_none()
    if not item or not item.is_active:
        raise HTTPException(status_code=404, detail="Инвентарь не найден")
    if item.quantity_available < data.quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Доступно только {item.quantity_available} шт.",
        )
    item.quantity_available -= data.quantity
    rental = EquipmentRental(
        equipment_id=data.equipment_id,
        user_id=data.user_id,
        booking_id=data.booking_id,
        created_by_id=admin.id,
        quantity=data.quantity,
        rented_at=datetime.now(timezone.utc),
        status="active",
    )
    db.add(rental)
    await db.commit()
    await db.refresh(rental)
    res = await db.execute(
        select(EquipmentRental).where(EquipmentRental.id == rental.id).options(*RENTAL_OPTS)
    )
    return res.scalar_one()


@router.post("/rentals/{rental_id}/return", response_model=RentalResponse)
async def return_rental(
    rental_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    res = await db.execute(
        select(EquipmentRental).where(EquipmentRental.id == rental_id).options(*RENTAL_OPTS)
    )
    rental = res.scalar_one_or_none()
    if not rental:
        raise HTTPException(status_code=404, detail="Аренда не найдена")
    if rental.status == "returned":
        raise HTTPException(status_code=400, detail="Уже возвращено")
    rental.status = "returned"
    rental.returned_at = datetime.now(timezone.utc)
    # вернуть единицы в наличие
    item_res = await db.execute(select(Equipment).where(Equipment.id == rental.equipment_id))
    item = item_res.scalar_one_or_none()
    if item:
        item.quantity_available = min(item.quantity_total, item.quantity_available + rental.quantity)
    await db.commit()
    await db.refresh(rental)
    return rental
