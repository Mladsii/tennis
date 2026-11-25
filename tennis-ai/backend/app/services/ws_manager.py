import asyncio
import uuid
from collections import defaultdict
from typing import Any

from fastapi import WebSocket


class ChatConnectionManager:
    """In-memory registry of active WebSocket connections per user.

    A user can have several connections (multiple devices); we broadcast to all.
    """

    def __init__(self) -> None:
        self._connections: dict[uuid.UUID, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, user_id: uuid.UUID, ws: WebSocket) -> None:
        async with self._lock:
            self._connections[user_id].add(ws)

    async def disconnect(self, user_id: uuid.UUID, ws: WebSocket) -> None:
        async with self._lock:
            sockets = self._connections.get(user_id)
            if not sockets:
                return
            sockets.discard(ws)
            if not sockets:
                self._connections.pop(user_id, None)

    async def send_to_user(self, user_id: uuid.UUID, payload: dict[str, Any]) -> None:
        async with self._lock:
            sockets = list(self._connections.get(user_id, ()))
        for ws in sockets:
            try:
                await ws.send_json(payload)
            except Exception:
                await self.disconnect(user_id, ws)


chat_manager = ChatConnectionManager()
