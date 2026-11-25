from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.reference import NtrpStmLevel

router = APIRouter(prefix="/reference", tags=["reference"])


class NtrpStmResponse(BaseModel):
    id: int
    ntrp: str
    stm: str
    description: str | None

    model_config = {"from_attributes": True}


@router.get("/ntrp-stm", response_model=list[NtrpStmResponse])
async def get_ntrp_stm_levels(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(NtrpStmLevel).order_by(NtrpStmLevel.sort_order)
    )
    return list(result.scalars().all())


@router.get("/surfaces")
async def get_surface_types(sport: str | None = None):
    tennis_surfaces = [
        {"value": "grass", "label": "Травяной"},
        {"value": "clay", "label": "Грунтовый"},
        {"value": "hard", "label": "Хард"},
        {"value": "carpet", "label": "Ковровый"},
        {"value": "concrete", "label": "Бетонный"},
        {"value": "parquet", "label": "Паркетный"},
        {"value": "asphalt", "label": "Асфальтный"},
        {"value": "wood", "label": "Деревянный"},
        {"value": "rubber", "label": "Резиновый"},
    ]
    padel_surfaces = [
        {"value": "hard", "label": "Хард"},
        {"value": "artif_grass", "label": "Искусственная трава"},
    ]
    if sport == "padel":
        return padel_surfaces
    if sport == "tennis":
        return tennis_surfaces
    return tennis_surfaces + [{"value": "artif_grass", "label": "Искусственная трава"}]


@router.get("/court-types")
async def get_court_types():
    return [
        {"value": "indoor", "label": "Закрытый корт (с крышей)"},
        {"value": "outdoor", "label": "Открытый корт (без крыши)"},
    ]


@router.get("/sports")
async def get_sports():
    return [
        {"value": "tennis", "label": "Большой теннис"},
        {"value": "padel", "label": "Падел-теннис"},
    ]
