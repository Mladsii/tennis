import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.user import UserPublicResponse


class TrainingParticipantBrief(BaseModel):
    id: uuid.UUID
    user: UserPublicResponse
    status: str

    model_config = {"from_attributes": True}


class TrainingCreate(BaseModel):
    title: str
    description: str | None = None
    location: str | None = None
    schedule_type: Literal["one_time", "weekly"] = "one_time"
    start_time: datetime
    end_time: datetime
    weeks_count: int | None = None
    max_participants: int | None = None
    trainer_id: uuid.UUID | None = None
    invite_user_ids: list[uuid.UUID] = []


class TrainingResponse(BaseModel):
    id: uuid.UUID
    organizer: UserPublicResponse
    trainer: UserPublicResponse | None
    title: str
    description: str | None
    location: str | None
    schedule_type: str
    start_time: datetime
    end_time: datetime
    weeks_count: int | None
    max_participants: int | None
    status: str
    participants: list[TrainingParticipantBrief]
    organizer_id: uuid.UUID

    model_config = {"from_attributes": True}


class TrainingListItem(BaseModel):
    id: uuid.UUID
    title: str
    location: str | None
    schedule_type: str
    start_time: datetime
    end_time: datetime
    organizer: UserPublicResponse
    confirmed_count: int

    model_config = {"from_attributes": True}


class InvitePayload(BaseModel):
    user_id: uuid.UUID


class ParticipantStatusUpdate(BaseModel):
    status: Literal["confirmed", "declined", "cancelled"]
