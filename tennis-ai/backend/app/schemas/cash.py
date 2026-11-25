import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel

from app.schemas.user import UserPublicResponse


class CashSessionCreate(BaseModel):
    notes: str | None = None


class CashSessionResponse(BaseModel):
    id: uuid.UUID
    opened_by: UserPublicResponse | None
    opened_at: datetime
    closed_at: datetime | None
    status: str
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def model_validate(cls, obj, *args, **kwargs):
        # map created_at → opened_at
        if hasattr(obj, "created_at") and not hasattr(obj, "opened_at"):
            obj.opened_at = obj.created_at
        return super().model_validate(obj, *args, **kwargs)


class CashTransactionCreate(BaseModel):
    booking_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None
    amount: Decimal
    payment_type: str   # "cash" | "card" | "sbp" | "subscription"
    description: str = ""
    subscription_id: uuid.UUID | None = None


class CashTransactionResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    booking_id: uuid.UUID | None
    user: UserPublicResponse | None
    created_by: UserPublicResponse | None
    amount: Decimal
    payment_type: str
    description: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class CashReportResponse(BaseModel):
    session: CashSessionResponse
    total_cash: Decimal
    total_card: Decimal
    total_sbp: Decimal
    total_subscription: Decimal
    total_all: Decimal
    transaction_count: int
    transactions: list[CashTransactionResponse]
