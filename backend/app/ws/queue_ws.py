import logging
from uuid import UUID

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.redis import get_redis
from app.services.queue_service import QueueService
from app.utils.security import decode_token
from app.ws.manager import manager

log = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws/queue/{event_id}")
async def queue_ws(
    websocket: WebSocket,
    event_id: UUID,
    token: str = Query(default=""),
):
    """WebSocket for queue position updates and grant notifications.

    Clients connect with ?token=<JWT>.  On disconnect, if the user was
    in the granted set we release the slot so the next person can enter.
    """
    # Authenticate via query-param JWT
    user_id: str | None = None
    if token:
        try:
            payload = decode_token(token)
            user_id = payload.get("sub")
        except ValueError:
            pass

    room = f"queue:{event_id}"
    await manager.connect(room, websocket)
    try:
        while True:
            await websocket.receive_text()  # keep-alive
    except WebSocketDisconnect:
        pass
    except Exception:  # noqa: BLE001
        log.exception("Queue WebSocket error for event %s", event_id)
    finally:
        await manager.disconnect(room, websocket)
        # Release the granted slot when user disconnects
        if user_id:
            try:
                redis = await get_redis()
                await QueueService(redis).release_access(str(event_id), user_id)
            except Exception:  # noqa: BLE001
                log.exception("Failed to release queue slot on WS disconnect")
