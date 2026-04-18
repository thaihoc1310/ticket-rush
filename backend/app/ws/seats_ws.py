import logging
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.ws.manager import manager

log = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws/events/{event_id}/seats")
async def seats_ws(websocket: WebSocket, event_id: UUID):
    room = str(event_id)
    await manager.connect(room, websocket)
    try:
        while True:
            # Keep connection open. Incoming messages are ignored (read to detect close).
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:  # noqa: BLE001
        log.exception("WebSocket error for event %s", event_id)
    finally:
        await manager.disconnect(room, websocket)
