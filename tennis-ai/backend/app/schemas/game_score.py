import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.user import UserPublicResponse

PointValue = Literal["0", "15", "30", "40", "Ad"]


class GameScoreCreate(BaseModel):
    opponent_id: uuid.UUID
    server_id: uuid.UUID
    played_at: datetime
    creator_points: PointValue
    opponent_points: PointValue
    notes: str | None = None


class GameScoreDecline(BaseModel):
    reason: str | None = None


class GameScoreResponse(BaseModel):
    id: uuid.UUID
    creator: UserPublicResponse
    opponent: UserPublicResponse
    server: UserPublicResponse
    played_at: datetime
    creator_points: str
    opponent_points: str
    notes: str | None
    status: str
    decline_reason: str | None
    confirmed_at: datetime | None
    creator_id: uuid.UUID
    opponent_id: uuid.UUID
    server_id: uuid.UUID

    model_config = {"from_attributes": True}
