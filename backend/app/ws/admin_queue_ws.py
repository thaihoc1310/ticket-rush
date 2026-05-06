"""Admin-only WebSocket for real-time queue stats updates."""

import logging
from uuid import UUID

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.utils.security import decode_token
from app.ws.manager import manager

log = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws/admin/queue/{event_id}")
async def admin_queue_ws(
    websocket: WebSocket,
    event_id: UUID,
    token: str = Query(default=""),
):
    """WebSocket for admin real-time queue dashboard.

    Requires an admin JWT token via ?token=<JWT>.
    Receives queue_admin_update messages whenever the queue state changes.
    """
    # Authenticate via query-param JWT — must be an admin
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return

    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            await websocket.close(code=4001, reason="Invalid token type")
            return
    except ValueError:
        await websocket.close(code=4001, reason="Invalid token")
        return

    room = f"admin:queue:{event_id}"
    await manager.connect(room, websocket)
    try:
        while True:
            await websocket.receive_text()  # keep-alive
    except WebSocketDisconnect:
        pass
    except Exception:  # noqa: BLE001
        log.exception("Admin queue WebSocket error for event %s", event_id)
    finally:
        await manager.disconnect(room, websocket)
