import uuid
from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.schemas.user import UserPublicResponse


class MatchSetCreate(BaseModel):
    opponent_id: uuid.UUID
    played_at: datetime
    creator_games: int = Field(ge=0, le=7)
    opponent_games: int = Field(ge=0, le=7)
    creator_tiebreak: int | None = Field(None, ge=0)
    opponent_tiebreak: int | None = Field(None, ge=0)
    notes: str | None = None
    photo_url: str | None = Field(None, max_length=500)

    @model_validator(mode="after")
    def validate_score(self):
        a, b = self.creator_games, self.opponent_games
        if a == b:
            raise ValueError("Set must have a winner; games cannot be equal")
        hi, lo = max(a, b), min(a, b)
        # Standard tennis: 6-0..6-4, 7-5, 7-6 (tiebreak)
        valid = (
            (hi == 6 and lo <= 4)
            or (hi == 7 and lo == 5)
            or (hi == 7 and lo == 6)
        )
        if not valid:
            raise ValueError("Invalid set score; expected 6-0..6-4, 7-5 or 7-6")
        if hi == 7 and lo == 6:
            if self.creator_tiebreak is None or self.opponent_tiebreak is None:
                raise ValueError("Tiebreak score required for 7-6 sets")
        return self


class MatchSetDecline(BaseModel):
    decline_reason: str | None = None


class MatchSetResponse(BaseModel):
    id: uuid.UUID
    creator_id: uuid.UUID
    opponent_id: uuid.UUID
    creator: UserPublicResponse
    opponent: UserPublicResponse
    played_at: datetime
    creator_games: int
    opponent_games: int
    creator_tiebreak: int | None
    opponent_tiebreak: int | None
    notes: str | None
    photo_url: str | None
    status: str
    decline_reason: str | None
    confirmed_at: datetime | None
    creator_elo_before: int | None
    opponent_elo_before: int | None
    creator_elo_change: int | None
    opponent_elo_change: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PlayerRanking(BaseModel):
    user: UserPublicResponse
    elo_rating: int
    wins: int
    losses: int


class MyMatchStats(BaseModel):
    wins: int
    losses: int
    pending_incoming: int
    pending_outgoing: int
    elo_rating: int


class EloPoint(BaseModel):
    date: str   # YYYY-MM-DD
    elo: int
