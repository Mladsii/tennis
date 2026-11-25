import uuid
from datetime import datetime

from pydantic import BaseModel

from app.schemas.user import UserPublicResponse


class CourtTransferCreate(BaseModel):
    location_id: uuid.UUID
    start_time: datetime
    end_time: datetime
    is_paid: bool = False
    notes: str | None = None


class CourtTransferUpdate(BaseModel):
    location_id: uuid.UUID | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    is_paid: bool | None = None
    notes: str | None = None


class CourtTransferResponseAction(BaseModel):
    decline_reason: str | None = None


class CourtTransferResponseOut(BaseModel):
    id: uuid.UUID
    court_transfer_id: uuid.UUID
    responder_id: uuid.UUID
    responder: UserPublicResponse
    status: str
    decline_reason: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class CourtTransferDetail(BaseModel):
    id: uuid.UUID
    author_id: uuid.UUID
    author: UserPublicResponse
    location_id: uuid.UUID
    start_time: datetime
    end_time: datetime
    is_paid: bool
    notes: str | None
    is_active: bool
    created_at: datetime
    responses: list[CourtTransferResponseOut] = []

    model_config = {"from_attributes": True}


class CourtTransferListItem(BaseModel):
    id: uuid.UUID
    author_id: uuid.UUID
    author: UserPublicResponse
    location_id: uuid.UUID
    start_time: datetime
    end_time: datetime
    is_paid: bool
    notes: str | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
