import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class LocationCreate(BaseModel):
    name: str = Field(max_length=200)
    address: str
    city: str = Field(max_length=100)
    latitude: float
    longitude: float


class LocationUpdate(BaseModel):
    name: str | None = Field(None, max_length=200)
    address: str | None = None
    city: str | None = Field(None, max_length=100)
    latitude: float | None = None
    longitude: float | None = None
    is_active: bool | None = None


class CourtCreate(BaseModel):
    name: str = Field(max_length=100)
    sport: str = Field(default="tennis", pattern="^(tennis|padel)$")
    is_singles_only: bool = False
    is_doubles_or_singles: bool = True
    court_type: str = Field(pattern="^(indoor|outdoor)$")
    surface_type: str = Field(max_length=20)
    is_active: bool = True


class CourtUpdate(BaseModel):
    name: str | None = Field(None, max_length=100)
    sport: str | None = Field(None, pattern="^(tennis|padel)$")
    is_singles_only: bool | None = None
    is_doubles_or_singles: bool | None = None
    court_type: str | None = Field(None, pattern="^(indoor|outdoor)$")
    surface_type: str | None = Field(None, max_length=20)
    is_active: bool | None = None


class CourtResponse(BaseModel):
    id: uuid.UUID
    location_id: uuid.UUID
    name: str
    sport: str
    is_singles_only: bool
    is_doubles_or_singles: bool
    court_type: str
    surface_type: str
    photo_url: str | None
    is_active: bool

    model_config = {"from_attributes": True}


class LocationResponse(BaseModel):
    id: uuid.UUID
    name: str
    address: str
    city: str
    latitude: float
    longitude: float
    is_active: bool
    courts: list[CourtResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class LocationListResponse(BaseModel):
    id: uuid.UUID
    name: str
    address: str
    city: str
    latitude: float
    longitude: float
    is_active: bool

    model_config = {"from_attributes": True}


class PreferredLocationCreate(BaseModel):
    location_id: uuid.UUID
    use_in_search: bool = True


class PreferredLocationUpdate(BaseModel):
    use_in_search: bool


class PreferredLocationResponse(BaseModel):
    id: uuid.UUID
    location_id: uuid.UUID
    use_in_search: bool
    location: LocationListResponse

    model_config = {"from_attributes": True}
