"""APScheduler job: grant queue slots every 5 seconds."""

import logging

from app.redis import get_redis
from app.services.queue_service import QueueService

log = logging.getLogger(__name__)

GRANT_LOCK_KEY = "lock:queue_grant"
GRANT_LOCK_TTL = 4  # seconds — must be < interval (5s)


async def grant_queue_batch() -> None:
    """Scan all enabled queues and grant waiting users if slots are free."""
    redis = await get_redis()
    acquired = await redis.set(GRANT_LOCK_KEY, "1", nx=True, ex=GRANT_LOCK_TTL)
    if not acquired:
        return  # another instance is already handling this

    try:
        svc = QueueService(redis)
        await svc.grant_batch_all_events()
    except Exception:  # noqa: BLE001
        log.exception("Error in grant_queue_batch job")
    finally:
        try:
            await redis.delete(GRANT_LOCK_KEY)
        except Exception:  # noqa: BLE001
            pass
