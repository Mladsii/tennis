import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ChatPeer(BaseModel):
    id: uuid.UUID
    full_name: str
    phone: str

    model_config = {"from_attributes": True}


class MessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class MessageEdit(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class MessageResponse(BaseModel):
    id: uuid.UUID
    conversation_id: uuid.UUID
    sender_id: uuid.UUID
    body: str
    is_read: bool
    edited_at: datetime | None
    deleted_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationResponse(BaseModel):
    id: uuid.UUID
    peer: ChatPeer
    last_message: MessageResponse | None
    unread_count: int
    last_message_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationCreate(BaseModel):
    peer_id: uuid.UUID
