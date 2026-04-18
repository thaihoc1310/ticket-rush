import asyncio
import json
import logging

from redis.asyncio import Redis

from app.ws.manager import manager

log = logging.getLogger(__name__)

SEAT_CHANNEL_PATTERN = "event:*:seats"


async def run_seat_pubsub_listener(redis: Redis) -> None:
    """Long-running task: forwards `event:{id}:seats` messages to local WS rooms."""
    pubsub = redis.pubsub()
    await pubsub.psubscribe(SEAT_CHANNEL_PATTERN)
    log.info("WebSocket pub/sub listener subscribed to %s", SEAT_CHANNEL_PATTERN)
    try:
        async for message in pubsub.listen():
            if message.get("type") != "pmessage":
                continue
            channel = message["channel"]
            # channel may be bytes or str depending on decode_responses.
            if isinstance(channel, bytes):
                channel = channel.decode()
            parts = channel.split(":")
            if len(parts) < 3:
                continue
            event_id = parts[1]
            raw = message["data"]
            if isinstance(raw, bytes):
                raw = raw.decode()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                log.warning("Invalid pub/sub payload on %s", channel)
                continue
            await manager.broadcast(event_id, {"type": "seat_update", **data})
    except asyncio.CancelledError:
        log.info("Seat pub/sub listener cancelled")
        raise
    finally:
        try:
            await pubsub.punsubscribe(SEAT_CHANNEL_PATTERN)
            await pubsub.close()
        except Exception:  # noqa: BLE001
            log.exception("Error closing pub/sub subscription")
