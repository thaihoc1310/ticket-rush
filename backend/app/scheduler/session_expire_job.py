"""APScheduler job: expire queue sessions every 5 seconds."""

import logging

from app.redis import get_redis
from app.services.queue_service import QueueService

log = logging.getLogger(__name__)

EXPIRE_LOCK_KEY = "lock:queue_expire"
EXPIRE_LOCK_TTL = 4  # seconds — must be < interval (5s)


async def expire_queue_sessions() -> None:
    """Scan all enabled queues and expire users who exceeded session TTL."""
    redis = await get_redis()
    acquired = await redis.set(EXPIRE_LOCK_KEY, "1", nx=True, ex=EXPIRE_LOCK_TTL)
    if not acquired:
        return  # another instance is already handling this

    try:
        svc = QueueService(redis)
        await svc.expire_sessions_all_events()
    except Exception:  # noqa: BLE001
        log.exception("Error in expire_queue_sessions job")
    finally:
        try:
            await redis.delete(EXPIRE_LOCK_KEY)
        except Exception:  # noqa: BLE001
            pass
