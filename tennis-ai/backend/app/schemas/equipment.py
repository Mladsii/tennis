import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel

from app.schemas.user import UserPublicResponse


class EquipmentCreate(BaseModel):
    location_id: uuid.UUID
    name: str
    equipment_type: str   # "racket" | "balls" | "basket" | "other"
    quantity_total: int = 1
    price_per_hour: Decimal | None = None


class EquipmentUpdate(BaseModel):
    name: str | None = None
    equipment_type: str | None = None
    quantity_total: int | None = None
    price_per_hour: Decimal | None = None
    is_active: bool | None = None


class EquipmentResponse(BaseModel):
    id: uuid.UUID
    location_id: uuid.UUID
    name: str
    equipment_type: str
    quantity_total: int
    quantity_available: int
    price_per_hour: Decimal | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class RentalCreate(BaseModel):
    equipment_id: uuid.UUID
    user_id: uuid.UUID | None = None
    booking_id: uuid.UUID | None = None
    quantity: int = 1


class RentalResponse(BaseModel):
    id: uuid.UUID
    equipment: EquipmentResponse
    user: UserPublicResponse | None
    created_by: UserPublicResponse | None
    booking_id: uuid.UUID | None
    quantity: int
    rented_at: datetime
    returned_at: datetime | None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}
