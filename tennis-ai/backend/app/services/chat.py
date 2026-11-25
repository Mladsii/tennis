import uuid
from datetime import datetime, timedelta, timezone
from typing import Sequence

from sqlalchemy import and_, desc, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat import Conversation, Message
from app.models.user import User

EDIT_WINDOW_MINUTES = 5


def _ordered_pair(a: uuid.UUID, b: uuid.UUID) -> tuple[uuid.UUID, uuid.UUID]:
    """Return pair sorted to enforce a single conversation row per user pair."""
    return (a, b) if str(a) < str(b) else (b, a)


async def get_or_create_conversation(
    db: AsyncSession, user_id: uuid.UUID, peer_id: uuid.UUID
) -> Conversation:
    if user_id == peer_id:
        raise ValueError("cannot start conversation with self")
    a, b = _ordered_pair(user_id, peer_id)
    result = await db.execute(
        select(Conversation).where(
            Conversation.user_a_id == a, Conversation.user_b_id == b
        )
    )
    conv = result.scalar_one_or_none()
    if conv is not None:
        return conv
    conv = Conversation(user_a_id=a, user_b_id=b)
    db.add(conv)
    await db.flush()
    return conv


async def get_conversation_for_user(
    db: AsyncSession, conversation_id: uuid.UUID, user_id: uuid.UUID
) -> Conversation | None:
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            or_(
                Conversation.user_a_id == user_id,
                Conversation.user_b_id == user_id,
            ),
        )
    )
    return result.scalar_one_or_none()


async def list_conversations_with_meta(
    db: AsyncSession, user_id: uuid.UUID
) -> list[dict]:
    convs_q = await db.execute(
        select(Conversation)
        .where(
            or_(
                Conversation.user_a_id == user_id,
                Conversation.user_b_id == user_id,
            )
        )
        .order_by(desc(Conversation.last_message_at), desc(Conversation.created_at))
    )
    convs = list(convs_q.scalars().all())
    if not convs:
        return []

    peer_ids = [
        c.user_b_id if c.user_a_id == user_id else c.user_a_id for c in convs
    ]
    peers_q = await db.execute(select(User).where(User.id.in_(peer_ids)))
    peers = {u.id: u for u in peers_q.scalars().all()}

    result: list[dict] = []
    for c in convs:
        peer_id = c.user_b_id if c.user_a_id == user_id else c.user_a_id
        peer = peers.get(peer_id)
        if peer is None:
            continue
        last_msg_q = await db.execute(
            select(Message)
            .where(Message.conversation_id == c.id)
            .order_by(desc(Message.created_at))
            .limit(1)
        )
        last_msg = last_msg_q.scalar_one_or_none()
        unread_q = await db.execute(
            select(func.count())
            .select_from(Message)
            .where(
                Message.conversation_id == c.id,
                Message.sender_id != user_id,
                Message.is_read.is_(False),
                Message.deleted_at.is_(None),
            )
        )
        unread = unread_q.scalar_one()
        result.append(
            {
                "id": c.id,
                "peer": {
                    "id": peer.id,
                    "full_name": _full_name(peer),
                    "phone": peer.phone_primary,
                },
                "last_message": last_msg,
                "unread_count": unread,
                "last_message_at": c.last_message_at,
                "created_at": c.created_at,
            }
        )
    return result


async def list_messages(
    db: AsyncSession,
    conversation_id: uuid.UUID,
    before: datetime | None = None,
    limit: int = 50,
) -> list[Message]:
    stmt = select(Message).where(Message.conversation_id == conversation_id)
    if before is not None:
        stmt = stmt.where(Message.created_at < before)
    stmt = stmt.order_by(desc(Message.created_at)).limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())[::-1]


async def create_message(
    db: AsyncSession,
    conversation: Conversation,
    sender_id: uuid.UUID,
    body: str,
) -> Message:
    msg = Message(
        conversation_id=conversation.id,
        sender_id=sender_id,
        body=body.strip(),
    )
    db.add(msg)
    conversation.last_message_at = datetime.now(timezone.utc)
    await db.flush()
    return msg


async def mark_messages_read(
    db: AsyncSession, conversation_id: uuid.UUID, user_id: uuid.UUID
) -> int:
    result = await db.execute(
        update(Message)
        .where(
            Message.conversation_id == conversation_id,
            Message.sender_id != user_id,
            Message.is_read.is_(False),
        )
        .values(is_read=True)
    )
    await db.flush()
    return result.rowcount


async def edit_message(
    db: AsyncSession, message_id: uuid.UUID, user_id: uuid.UUID, body: str
) -> Message | None:
    result = await db.execute(select(Message).where(Message.id == message_id))
    msg = result.scalar_one_or_none()
    if msg is None or msg.sender_id != user_id or msg.deleted_at is not None:
        return None
    if datetime.now(timezone.utc) - msg.created_at > timedelta(minutes=EDIT_WINDOW_MINUTES):
        return None
    msg.body = body.strip()
    msg.edited_at = datetime.now(timezone.utc)
    await db.flush()
    return msg


async def delete_message(
    db: AsyncSession, message_id: uuid.UUID, user_id: uuid.UUID
) -> bool:
    result = await db.execute(select(Message).where(Message.id == message_id))
    msg = result.scalar_one_or_none()
    if msg is None or msg.sender_id != user_id or msg.deleted_at is not None:
        return False
    msg.deleted_at = datetime.now(timezone.utc)
    msg.body = ""
    await db.flush()
    return True


async def total_unread_messages(db: AsyncSession, user_id: uuid.UUID) -> int:
    convs_q = await db.execute(
        select(Conversation.id).where(
            or_(
                Conversation.user_a_id == user_id,
                Conversation.user_b_id == user_id,
            )
        )
    )
    conv_ids = [r[0] for r in convs_q.all()]
    if not conv_ids:
        return 0
    result = await db.execute(
        select(func.count())
        .select_from(Message)
        .where(
            Message.conversation_id.in_(conv_ids),
            Message.sender_id != user_id,
            Message.is_read.is_(False),
            Message.deleted_at.is_(None),
        )
    )
    return result.scalar_one()


def _full_name(user: User) -> str:
    parts = [user.last_name, user.first_name]
    if user.patronymic:
        parts.append(user.patronymic)
    return " ".join(p for p in parts if p)
