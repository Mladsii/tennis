import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel

from app.schemas.user import UserPublicResponse


class SubscriptionPlanCreate(BaseModel):
    name: str
    description: str | None = None
    price: Decimal
    hours_total: int
    validity_days: int


class SubscriptionPlanUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    price: Decimal | None = None
    hours_total: int | None = None
    validity_days: int | None = None
    is_active: bool | None = None


class SubscriptionPlanResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    price: Decimal
    hours_total: int
    validity_days: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class SubscriptionSell(BaseModel):
    plan_id: uuid.UUID
    user_id: uuid.UUID


class UserSubscriptionResponse(BaseModel):
    id: uuid.UUID
    plan: SubscriptionPlanResponse
    user: UserPublicResponse
    sold_by: UserPublicResponse | None
    hours_remaining: Decimal
    purchased_at: datetime
    expires_at: datetime
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}
