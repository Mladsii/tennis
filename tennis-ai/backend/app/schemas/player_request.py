import uuid
from datetime import datetime

from pydantic import BaseModel

from app.schemas.user import UserPublicResponse


class PlayerRequestCreate(BaseModel):
    target_phone: str | None = None
    target_user_id: uuid.UUID | None = None
    target_name: str | None = None


class PlayerRequestResponse(BaseModel):
    id: uuid.UUID
    requester_id: uuid.UUID
    requester: UserPublicResponse
    target_phone: str
    target_user_id: uuid.UUID | None
    target_user: UserPublicResponse | None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class PreferredPlayerResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    player_id: uuid.UUID
    player: UserPublicResponse
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class PreferredPlayerUpdate(BaseModel):
    is_active: bool
