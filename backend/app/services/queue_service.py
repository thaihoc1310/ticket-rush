"""
Virtual Queue Service — fully Redis-backed.

Redis key layout
────────────────
queue:event:{eid}:enabled          string "1" / absent
queue:event:{eid}:max_concurrent   string (int)
queue:event:{eid}:session_ttl      string (int, seconds)
queue:{eid}                        ZSET  score=timestamp, member=userId
queue:{eid}:granted                SET   of granted user-id strings
queue:{eid}:grant_times            ZSET  score=grant_timestamp, member=userId
"""

import json
import logging
import time
from datetime import timedelta
from uuid import UUID

from redis.asyncio import Redis

from app.utils.security import _create_token

log = logging.getLogger(__name__)

# JWT for queue access — short-lived, 10 minutes
QUEUE_TOKEN_TTL = timedelta(minutes=10)

# Default session TTL (seconds) — 5 minutes
DEFAULT_SESSION_TTL = 300


# ── Redis key helpers ──────────────────────────────────────────────────────

def _enabled_key(event_id: UUID | str) -> str:
    return f"queue:event:{event_id}:enabled"


def _max_key(event_id: UUID | str) -> str:
    return f"queue:event:{event_id}:max_concurrent"


def _ttl_key(event_id: UUID | str) -> str:
    return f"queue:event:{event_id}:session_ttl"


def _zset_key(event_id: UUID | str) -> str:
    return f"queue:{event_id}"


def _granted_key(event_id: UUID | str) -> str:
    return f"queue:{event_id}:granted"


def _grant_times_key(event_id: UUID | str) -> str:
    return f"queue:{event_id}:grant_times"


def _grants_channel(event_id: UUID | str) -> str:
    return f"queue:{event_id}:grants"


def _admin_channel(event_id: UUID | str) -> str:
    return f"queue:{event_id}:admin"


# ── Service class ──────────────────────────────────────────────────────────

class QueueService:
    def __init__(self, redis: Redis):
        self.redis = redis

    # ── Admin configuration ────────────────────────────────────────────

    async def configure(
        self, event_id: UUID, *, max_concurrent: int, enabled: bool,
        session_ttl_seconds: int = DEFAULT_SESSION_TTL,
    ) -> dict:
        eid = str(event_id)
        pipe = self.redis.pipeline(transaction=True)
        if enabled:
            pipe.set(_enabled_key(eid), "1")
        else:
            pipe.delete(_enabled_key(eid))
        pipe.set(_max_key(eid), str(max_concurrent))
        pipe.set(_ttl_key(eid), str(session_ttl_seconds))
        await pipe.execute()
        # Notify admin WS
        await self._publish_admin_update(eid)
        return await self.get_config(event_id)

    async def get_config(self, event_id: UUID) -> dict:
        eid = str(event_id)
        pipe = self.redis.pipeline(transaction=False)
        pipe.get(_enabled_key(eid))
        pipe.get(_max_key(eid))
        pipe.scard(_granted_key(eid))
        pipe.zcard(_zset_key(eid))
        pipe.get(_ttl_key(eid))
        enabled_raw, max_raw, active, queue_len, ttl_raw = await pipe.execute()
        return {
            "event_id": eid,
            "enabled": enabled_raw == "1",
            "max_concurrent": int(max_raw) if max_raw else 0,
            "current_active": active,
            "queue_length": queue_len,
            "session_ttl_seconds": int(ttl_raw) if ttl_raw else DEFAULT_SESSION_TTL,
        }

    # ── Customer: join / status / leave ────────────────────────────────

    async def is_queue_active(self, event_id: UUID | str) -> bool:
        return await self.redis.get(_enabled_key(str(event_id))) == "1"

    async def _max_concurrent(self, event_id: str) -> int:
        val = await self.redis.get(_max_key(event_id))
        return int(val) if val else 0

    async def _session_ttl(self, event_id: str) -> int:
        val = await self.redis.get(_ttl_key(event_id))
        return int(val) if val else DEFAULT_SESSION_TTL

    async def join(self, event_id: UUID, user_id: UUID) -> dict:
        """Join queue or get direct access.  Returns status dict."""
        eid = str(event_id)
        uid = str(user_id)
        session_ttl = await self._session_ttl(eid)

        # Queue not active → everyone enters directly
        if not await self.is_queue_active(eid):
            return {
                "status": "INACTIVE",
                "position": None,
                "queue_size": 0,
                "access_token": None,
                "session_ttl_seconds": None,
                "granted_at": None,
            }

        # Already granted → return token again
        if await self.redis.sismember(_granted_key(eid), uid):
            token = self._make_token(event_id, user_id)
            granted_at = await self.redis.zscore(_grant_times_key(eid), uid)
            return {
                "status": "GRANTED",
                "position": None,
                "queue_size": await self.redis.zcard(_zset_key(eid)),
                "access_token": token,
                "session_ttl_seconds": session_ttl,
                "granted_at": granted_at,
            }

        # Check if there is room
        max_c = await self._max_concurrent(eid)
        current = await self.redis.scard(_granted_key(eid))

        if current < max_c:
            # Grant immediately
            now = time.time()
            await self.redis.sadd(_granted_key(eid), uid)
            await self.redis.zadd(_grant_times_key(eid), {uid: now})
            token = self._make_token(event_id, user_id)
            # Notify admin WS
            await self._publish_admin_update(eid)
            return {
                "status": "GRANTED",
                "position": None,
                "queue_size": await self.redis.zcard(_zset_key(eid)),
                "access_token": token,
                "session_ttl_seconds": session_ttl,
                "granted_at": now,
            }

        # Add to waiting queue (idempotent — ZADD NX)
        await self.redis.zadd(_zset_key(eid), {uid: time.time()}, nx=True)
        rank = await self.redis.zrank(_zset_key(eid), uid)
        position = (rank + 1) if rank is not None else None
        queue_size = await self.redis.zcard(_zset_key(eid))
        # Notify admin WS
        await self._publish_admin_update(eid)
        return {
            "status": "WAITING",
            "position": position,
            "queue_size": queue_size,
            "access_token": None,
            "session_ttl_seconds": None,
            "granted_at": None,
        }

    async def get_status(self, event_id: UUID, user_id: UUID) -> dict:
        eid = str(event_id)
        uid = str(user_id)
        session_ttl = await self._session_ttl(eid)

        if not await self.is_queue_active(eid):
            return {
                "status": "INACTIVE",
                "position": None,
                "queue_size": 0,
                "access_token": None,
                "session_ttl_seconds": None,
                "granted_at": None,
            }

        if await self.redis.sismember(_granted_key(eid), uid):
            token = self._make_token(event_id, user_id)
            granted_at = await self.redis.zscore(_grant_times_key(eid), uid)
            return {
                "status": "GRANTED",
                "position": None,
                "queue_size": await self.redis.zcard(_zset_key(eid)),
                "access_token": token,
                "session_ttl_seconds": session_ttl,
                "granted_at": granted_at,
            }

        rank = await self.redis.zrank(_zset_key(eid), uid)
        if rank is None:
            # Not in queue and not granted — treat as new
            return await self.join(event_id, user_id)

        return {
            "status": "WAITING",
            "position": rank + 1,
            "queue_size": await self.redis.zcard(_zset_key(eid)),
            "access_token": None,
            "session_ttl_seconds": None,
            "granted_at": None,
        }

    async def leave(self, event_id: UUID, user_id: UUID) -> None:
        eid = str(event_id)
        uid = str(user_id)
        await self.redis.zrem(_zset_key(eid), uid)
        await self.redis.zrem(_grant_times_key(eid), uid)
        was_granted = await self.redis.srem(_granted_key(eid), uid)
        if was_granted:
            # Free slot — trigger a grant cycle
            await self._grant_next(eid)
        # Notify admin WS
        await self._publish_admin_update(eid)

    async def release_access(self, event_id: str, user_id: str) -> None:
        """Called when a user disconnects from the seat-selection WS."""
        await self.redis.zrem(_grant_times_key(event_id), user_id)
        was_granted = await self.redis.srem(_granted_key(event_id), user_id)
        if was_granted:
            log.info("Released queue slot for user %s on event %s", user_id, event_id)
            await self._grant_next(event_id)
            await self._publish_admin_update(event_id)

    async def kick_user(self, event_id: str, user_id: str) -> None:
        """Admin force-removal of a user from the granted set."""
        await self.redis.zrem(_zset_key(event_id), user_id)
        await self.redis.zrem(_grant_times_key(event_id), user_id)
        was_granted = await self.redis.srem(_granted_key(event_id), user_id)
        if was_granted:
            log.info("Admin kicked user %s from event %s", user_id, event_id)
            # Notify the user via the grants channel (same as session_expired)
            payload = {
                "type": "session_expired",
                "user_id": user_id,
                "event_id": event_id,
            }
            await self.redis.publish(_grants_channel(event_id), json.dumps(payload))
            await self._grant_next(event_id)
        await self._publish_admin_update(event_id)

    # ── Session expiry ─────────────────────────────────────────────────

    async def expire_sessions(self, event_id: str) -> None:
        """Expire users who exceeded their session TTL."""
        eid = event_id
        if not await self.is_queue_active(eid):
            return

        session_ttl = await self._session_ttl(eid)
        cutoff = time.time() - session_ttl

        # Find users granted before the cutoff
        expired = await self.redis.zrangebyscore(
            _grant_times_key(eid), "-inf", cutoff,
        )
        if not expired:
            return

        for uid_raw in expired:
            uid = uid_raw if isinstance(uid_raw, str) else uid_raw.decode()
            await self.redis.srem(_granted_key(eid), uid)
            await self.redis.zrem(_grant_times_key(eid), uid)
            log.info("Session expired for user %s on event %s", uid, eid)
            # Notify the user
            payload = {
                "type": "session_expired",
                "user_id": uid,
                "event_id": eid,
            }
            await self.redis.publish(_grants_channel(eid), json.dumps(payload))

        # Grant next users in line
        await self._grant_next(eid)
        await self._publish_admin_update(eid)

    async def expire_sessions_all_events(self) -> None:
        """Called by the scheduler — scan all enabled queues and expire."""
        cursor = "0"
        while True:
            cursor, keys = await self.redis.scan(
                cursor=cursor, match="queue:event:*:enabled", count=100,
            )
            for key in keys:
                parts = key.split(":") if isinstance(key, str) else key.decode().split(":")
                if len(parts) >= 3:
                    eid = parts[2]
                    try:
                        await self.expire_sessions(eid)
                    except Exception:  # noqa: BLE001
                        log.exception("Error expiring sessions for event %s", eid)
            if cursor == 0 or cursor == "0":
                break

    # ── Admin: list users ──────────────────────────────────────────────

    async def list_users(self, event_id: UUID | str) -> dict:
        """Return granted and waiting users with timestamps."""
        eid = str(event_id)

        # Granted users with their grant timestamps
        granted_raw = await self.redis.zrange(
            _grant_times_key(eid), 0, -1, withscores=True,
        )
        granted = []
        for member, score in granted_raw:
            uid = member if isinstance(member, str) else member.decode()
            granted.append({"user_id": uid, "granted_at": score})

        # Waiting users with their join timestamps and positions
        waiting_raw = await self.redis.zrange(
            _zset_key(eid), 0, -1, withscores=True,
        )
        waiting = []
        for idx, (member, score) in enumerate(waiting_raw):
            uid = member if isinstance(member, str) else member.decode()
            waiting.append({
                "user_id": uid,
                "joined_at": score,
                "position": idx + 1,
            })

        return {"granted": granted, "waiting": waiting}

    # ── Grant logic ────────────────────────────────────────────────────

    async def _grant_next(self, eid: str) -> None:
        """Grant the next user(s) in line if slots are available."""
        if not await self.is_queue_active(eid):
            return
        max_c = await self._max_concurrent(eid)
        current = await self.redis.scard(_granted_key(eid))
        slots = max_c - current
        if slots <= 0:
            return

        # Pop up to `slots` users from the sorted set
        popped = await self.redis.zpopmin(_zset_key(eid), count=slots)
        if not popped:
            return

        now = time.time()
        for member, _score in popped:
            uid = member if isinstance(member, str) else member.decode()
            await self.redis.sadd(_granted_key(eid), uid)
            await self.redis.zadd(_grant_times_key(eid), {uid: now})
            token = self._make_token(UUID(eid) if "-" in eid else eid, UUID(uid))
            session_ttl = await self._session_ttl(eid)
            payload = {
                "type": "queue_grant",
                "user_id": uid,
                "event_id": eid,
                "access_token": token,
                "session_ttl_seconds": session_ttl,
                "granted_at": now,
            }
            await self.redis.publish(_grants_channel(eid), json.dumps(payload))
            log.info("Granted queue access to user %s for event %s", uid, eid)

        await self._publish_admin_update(eid)

    async def grant_batch_all_events(self) -> None:
        """Called by the scheduler — scan all enabled queues and grant."""
        cursor = "0"
        while True:
            cursor, keys = await self.redis.scan(
                cursor=cursor, match="queue:event:*:enabled", count=100,
            )
            for key in keys:
                # Extract event_id from key "queue:event:{eid}:enabled"
                parts = key.split(":") if isinstance(key, str) else key.decode().split(":")
                if len(parts) >= 3:
                    eid = parts[2]
                    try:
                        await self._grant_next(eid)
                    except Exception:  # noqa: BLE001
                        log.exception("Error granting queue batch for event %s", eid)
            if cursor == 0 or cursor == "0":
                break

    # ── Access validation ──────────────────────────────────────────────

    async def is_user_granted(self, event_id: UUID | str, user_id: UUID | str) -> bool:
        return await self.redis.sismember(
            _granted_key(str(event_id)), str(user_id)
        )

    # ── Admin pub/sub notification ─────────────────────────────────────

    async def _publish_admin_update(self, event_id: str) -> None:
        """Publish a lightweight notification to the admin WS channel."""
        try:
            await self.redis.publish(
                _admin_channel(event_id),
                json.dumps({"type": "queue_admin_update", "event_id": event_id}),
            )
        except Exception:  # noqa: BLE001
            pass  # best-effort

    # ── Token helpers ──────────────────────────────────────────────────

    def _make_token(self, event_id: UUID | str, user_id: UUID | str) -> str:
        return _create_token(
            subject=str(user_id),
            expires_delta=QUEUE_TOKEN_TTL,
            token_type="queue_access",
            extra={"event_id": str(event_id)},
        )
