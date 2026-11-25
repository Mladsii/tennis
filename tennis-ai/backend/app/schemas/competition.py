import uuid
from datetime import date

from pydantic import BaseModel

from app.schemas.user import UserPublicResponse


# ---- Group ----

class CompetitionGroupCreate(BaseModel):
    name: str
    age_from: int | None = None
    age_to: int | None = None
    stm_from: float | None = None
    stm_to: float | None = None
    max_participants: int | None = None


class CompetitionParticipantBrief(BaseModel):
    id: uuid.UUID
    user: UserPublicResponse
    status: str

    model_config = {"from_attributes": True}


class CompetitionGroupResponse(BaseModel):
    id: uuid.UUID
    name: str
    age_from: int | None
    age_to: int | None
    stm_from: float | None
    stm_to: float | None
    max_participants: int | None
    participants: list[CompetitionParticipantBrief] = []

    model_config = {"from_attributes": True}


# ---- Competition ----

class CompetitionCreate(BaseModel):
    name: str
    description: str | None = None
    start_date: date
    end_date: date
    location: str | None = None
    groups: list[CompetitionGroupCreate] = []


class CompetitionListItem(BaseModel):
    id: uuid.UUID
    name: str
    organizer: UserPublicResponse
    start_date: date
    end_date: date
    location: str | None
    status: str
    participant_count: int

    model_config = {"from_attributes": True}


class CompetitionResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    organizer: UserPublicResponse
    start_date: date
    end_date: date
    location: str | None
    status: str
    groups: list[CompetitionGroupResponse] = []

    model_config = {"from_attributes": True}


class RegisterPayload(BaseModel):
    group_id: uuid.UUID
