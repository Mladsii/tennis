import uuid
from datetime import date, time

from pydantic import BaseModel

from app.schemas.user import UserPublicResponse


class QueueEntryCreate(BaseModel):
    court_id: uuid.UUID
    date: date
    slot_start: str    # "HH:MM"
    slot_end: str | None = None   # "HH:MM"; None → slot_start + 30 мин (обратная совместимость)
    min_duration: int = 60        # минимальная длительность игры, минуты
    accept_partial: bool = False  # уведомить даже если окно меньше min_duration
    any_court: bool = False  # если True — уведомим при освобождении любого корта локации
    user_id: uuid.UUID | None = None  # admin only; regular users enqueue themselves


class QueueEntryResponse(BaseModel):
    id: uuid.UUID
    court_id: uuid.UUID
    location_id: uuid.UUID | None = None
    any_court: bool = False
    user: UserPublicResponse
    date: date
    slot_start: str
    slot_end: str | None = None
    min_duration: int = 60
    accept_partial: bool = False
    status: str
    created_at: str
    court_name: str | None = None
    location_name: str | None = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_obj(cls, obj) -> "QueueEntryResponse":
        return cls(
            id=obj.id,
            court_id=obj.court_id,
            location_id=obj.location_id or (obj.court.location_id if getattr(obj, "court", None) else None),
            any_court=obj.any_court,
            user=obj.user,
            date=obj.date,
            slot_start=obj.slot_start.strftime("%H:%M"),
            slot_end=obj.slot_end.strftime("%H:%M") if obj.slot_end else None,
            min_duration=obj.min_duration,
            accept_partial=obj.accept_partial,
            status=obj.status,
            created_at=obj.created_at.isoformat(),
            court_name=obj.court.name if getattr(obj, "court", None) else None,
            location_name=obj.location.name if getattr(obj, "location", None) else (
                obj.court.location.name if getattr(obj, "court", None) and getattr(obj.court, "location", None) else None
            ),
        )
