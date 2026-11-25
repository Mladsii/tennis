import uuid
from datetime import datetime

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import async_session, get_db
from app.models.chat import Message
from app.models.user import User
from app.schemas.chat import (
    ConversationCreate,
    ConversationResponse,
    MessageCreate,
    MessageEdit,
    MessageResponse,
)
from app.services import chat as chat_service
from app.services.auth import decode_token
from app.services.ws_manager import chat_manager

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/conversations", response_model=list[ConversationResponse])
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    items = await chat_service.list_conversations_with_meta(db, current_user.id)
    return items


@router.post(
    "/conversations", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED
)
async def open_conversation(
    data: ConversationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.peer_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot start chat with self")
    peer_q = await db.execute(select(User).where(User.id == data.peer_id))
    peer = peer_q.scalar_one_or_none()
    if peer is None:
        raise HTTPException(status_code=404, detail="Peer not found")
    conv = await chat_service.get_or_create_conversation(db, current_user.id, peer.id)
    await db.commit()
    items = await chat_service.list_conversations_with_meta(db, current_user.id)
    for item in items:
        if item["id"] == conv.id:
            return item
    return {
        "id": conv.id,
        "peer": {
            "id": peer.id,
            "full_name": _full_name(peer),
            "phone": peer.phone_primary,
        },
        "last_message": None,
        "unread_count": 0,
        "last_message_at": conv.last_message_at,
        "created_at": conv.created_at,
    }


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=list[MessageResponse],
)
async def get_messages(
    conversation_id: uuid.UUID,
    before: datetime | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conv = await chat_service.get_conversation_for_user(
        db, conversation_id, current_user.id
    )
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return await chat_service.list_messages(db, conv.id, before=before, limit=limit)


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def post_message(
    conversation_id: uuid.UUID,
    data: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conv = await chat_service.get_conversation_for_user(
        db, conversation_id, current_user.id
    )
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    msg = await chat_service.create_message(db, conv, current_user.id, data.body)
    await db.commit()
    await db.refresh(msg)
    peer_id = conv.user_b_id if conv.user_a_id == current_user.id else conv.user_a_id
    payload = {
        "type": "message.created",
        "conversation_id": str(conv.id),
        "message": _serialize_msg(msg),
    }
    await chat_manager.send_to_user(peer_id, payload)
    await chat_manager.send_to_user(current_user.id, payload)
    return msg


@router.put(
    "/conversations/{conversation_id}/read", status_code=status.HTTP_204_NO_CONTENT
)
async def mark_read(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conv = await chat_service.get_conversation_for_user(
        db, conversation_id, current_user.id
    )
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await chat_service.mark_messages_read(db, conv.id, current_user.id)
    await db.commit()
    peer_id = conv.user_b_id if conv.user_a_id == current_user.id else conv.user_a_id
    await chat_manager.send_to_user(
        peer_id,
        {
            "type": "messages.read",
            "conversation_id": str(conv.id),
            "by_user_id": str(current_user.id),
        },
    )


@router.put("/messages/{message_id}", response_model=MessageResponse)
async def edit(
    message_id: uuid.UUID,
    data: MessageEdit,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    msg = await chat_service.edit_message(db, message_id, current_user.id, data.body)
    if msg is None:
        raise HTTPException(
            status_code=400,
            detail="Cannot edit message (not found, not yours, deleted, or edit window expired)",
        )
    await db.commit()
    await db.refresh(msg)
    conv = await chat_service.get_conversation_for_user(
        db, msg.conversation_id, current_user.id
    )
    if conv is not None:
        peer_id = conv.user_b_id if conv.user_a_id == current_user.id else conv.user_a_id
        payload = {
            "type": "message.edited",
            "conversation_id": str(conv.id),
            "message": _serialize_msg(msg),
        }
        await chat_manager.send_to_user(peer_id, payload)
        await chat_manager.send_to_user(current_user.id, payload)
    return msg


@router.delete("/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    message_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    msg_q = await db.execute(select(Message).where(Message.id == message_id))
    msg = msg_q.scalar_one_or_none()
    if msg is None:
        raise HTTPException(status_code=404, detail="Message not found")
    conv = await chat_service.get_conversation_for_user(
        db, msg.conversation_id, current_user.id
    )
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    ok = await chat_service.delete_message(db, message_id, current_user.id)
    if not ok:
        raise HTTPException(status_code=400, detail="Cannot delete this message")
    await db.commit()
    peer_id = conv.user_b_id if conv.user_a_id == current_user.id else conv.user_a_id
    payload = {
        "type": "message.deleted",
        "conversation_id": str(conv.id),
        "message_id": str(message_id),
    }
    await chat_manager.send_to_user(peer_id, payload)
    await chat_manager.send_to_user(current_user.id, payload)


@router.get("/unread-count")
async def unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count = await chat_service.total_unread_messages(db, current_user.id)
    return {"count": count}


@router.websocket("/ws")
async def chat_ws(websocket: WebSocket, token: str = Query(...)):
    payload = decode_token(token)
    if payload is None or payload.get("type") != "access" or not payload.get("sub"):
        await websocket.close(code=4401)
        return
    try:
        user_id = uuid.UUID(payload["sub"])
    except (ValueError, TypeError):
        await websocket.close(code=4401)
        return
    async with async_session() as db:
        result = await db.execute(select(User).where(User.id == user_id))
        if result.scalar_one_or_none() is None:
            await websocket.close(code=4401)
            return
    await websocket.accept()
    await chat_manager.connect(user_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await chat_manager.disconnect(user_id, websocket)


def _serialize_msg(msg) -> dict:
    return {
        "id": str(msg.id),
        "conversation_id": str(msg.conversation_id),
        "sender_id": str(msg.sender_id),
        "body": msg.body,
        "is_read": msg.is_read,
        "edited_at": msg.edited_at.isoformat() if msg.edited_at else None,
        "deleted_at": msg.deleted_at.isoformat() if msg.deleted_at else None,
        "created_at": msg.created_at.isoformat(),
    }


def _full_name(user: User) -> str:
    parts = [user.last_name, user.first_name]
    if user.patronymic:
        parts.append(user.patronymic)
    return " ".join(p for p in parts if p)
