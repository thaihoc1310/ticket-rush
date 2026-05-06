from uuid import UUID

from fastapi import APIRouter, Depends
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_user, require_admin
from app.models.user import User
from app.redis import get_redis
from app.schemas.queue import (
    QueueConfigIn,
    QueueConfigOut,
    QueueJoinOut,
    QueueStatusOut,
    QueueUserOut,
    QueueUsersOut,
)
from app.services.queue_service import QueueService

router = APIRouter(prefix="/api/queue", tags=["queue"])


def _svc(redis: Redis) -> QueueService:
    return QueueService(redis)


# ── Admin ──────────────────────────────────────────────────────────────────

@router.post("/{event_id}/configure", response_model=QueueConfigOut)
async def configure_queue(
    event_id: UUID,
    body: QueueConfigIn,
    _admin: User = Depends(require_admin),
    redis: Redis = Depends(get_redis),
):
    svc = _svc(redis)
    return await svc.configure(
        event_id,
        max_concurrent=body.max_concurrent,
        enabled=body.enabled,
        session_ttl_seconds=body.session_ttl_seconds,
    )


@router.get("/{event_id}/config", response_model=QueueConfigOut)
async def get_queue_config(
    event_id: UUID,
    _admin: User = Depends(require_admin),
    redis: Redis = Depends(get_redis),
):
    return await _svc(redis).get_config(event_id)


@router.get("/{event_id}/users", response_model=QueueUsersOut)
async def list_queue_users(
    event_id: UUID,
    _admin: User = Depends(require_admin),
    redis: Redis = Depends(get_redis),
    db: AsyncSession = Depends(get_db),
):
    """List all granted and waiting users with their profile info."""
    svc = _svc(redis)
    data = await svc.list_users(event_id)

    # Collect all user IDs and fetch their DB records
    all_ids = set()
    for u in data["granted"]:
        all_ids.add(u["user_id"])
    for u in data["waiting"]:
        all_ids.add(u["user_id"])

    user_map: dict[str, User] = {}
    if all_ids:
        uuids = [UUID(uid) for uid in all_ids]
        result = await db.execute(select(User).where(User.id.in_(uuids)))
        for user in result.scalars():
            user_map[str(user.id)] = user

    granted_out = []
    for u in data["granted"]:
        db_user = user_map.get(u["user_id"])
        granted_out.append(QueueUserOut(
            user_id=u["user_id"],
            email=db_user.email if db_user else "unknown",
            full_name=db_user.full_name if db_user else "Unknown",
            granted_at=u.get("granted_at"),
        ))

    waiting_out = []
    for u in data["waiting"]:
        db_user = user_map.get(u["user_id"])
        waiting_out.append(QueueUserOut(
            user_id=u["user_id"],
            email=db_user.email if db_user else "unknown",
            full_name=db_user.full_name if db_user else "Unknown",
            joined_at=u.get("joined_at"),
            position=u.get("position"),
        ))

    return QueueUsersOut(granted=granted_out, waiting=waiting_out)


@router.post("/{event_id}/kick/{user_id}")
async def kick_user(
    event_id: UUID,
    user_id: UUID,
    _admin: User = Depends(require_admin),
    redis: Redis = Depends(get_redis),
):
    """Force-remove a user from the granted set."""
    await _svc(redis).kick_user(str(event_id), str(user_id))
    return {"ok": True}


# ── Customer ───────────────────────────────────────────────────────────────

@router.post("/{event_id}/join", response_model=QueueJoinOut)
async def join_queue(
    event_id: UUID,
    user: User = Depends(get_current_user),
    redis: Redis = Depends(get_redis),
):
    return await _svc(redis).join(event_id, user.id)


@router.get("/{event_id}/status", response_model=QueueStatusOut)
async def queue_status(
    event_id: UUID,
    user: User = Depends(get_current_user),
    redis: Redis = Depends(get_redis),
):
    return await _svc(redis).get_status(event_id, user.id)


@router.post("/{event_id}/leave")
async def leave_queue(
    event_id: UUID,
    user: User = Depends(get_current_user),
    redis: Redis = Depends(get_redis),
):
    await _svc(redis).leave(event_id, user.id)
    return {"ok": True}
