from typing import Literal

from pydantic import BaseModel, Field


class QueueConfigIn(BaseModel):
    max_concurrent: int = Field(ge=1, le=10000, description="Max concurrent users in seat selection")
    enabled: bool = Field(description="Enable or disable the queue")
    session_ttl_seconds: int = Field(
        ge=60,
        le=3600,
        default=300,
        description="Max seconds a user can stay on the seat-selection page",
    )


class QueueConfigOut(BaseModel):
    event_id: str
    max_concurrent: int
    enabled: bool
    current_active: int
    queue_length: int
    session_ttl_seconds: int


class QueueJoinOut(BaseModel):
    status: Literal["GRANTED", "WAITING", "INACTIVE"]
    position: int | None = None
    queue_size: int = 0
    access_token: str | None = None
    session_ttl_seconds: int | None = None
    granted_at: float | None = None


class QueueStatusOut(BaseModel):
    status: Literal["GRANTED", "WAITING", "INACTIVE"]
    position: int | None = None
    queue_size: int = 0
    access_token: str | None = None
    session_ttl_seconds: int | None = None
    granted_at: float | None = None


class QueueUserOut(BaseModel):
    user_id: str
    email: str
    full_name: str
    granted_at: float | None = None
    joined_at: float | None = None
    position: int | None = None


class QueueUsersOut(BaseModel):
    granted: list[QueueUserOut]
    waiting: list[QueueUserOut]
