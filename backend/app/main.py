import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.redis import get_redis, get_redis_pool
from app.routers import auth as auth_router
from app.routers import bookings as bookings_router
from app.routers import dashboard as dashboard_router
from app.routers import events as events_router
from app.routers import payments as payments_router
from app.routers import queue as queue_router
from app.routers import seats as seats_router
from app.routers import tickets as tickets_router
from app.routers import uploads as uploads_router
from app.routers import users as users_router
from app.routers import venues as venues_router
from app.routers import zones as zones_router
from app.scheduler.setup import shutdown_scheduler, start_scheduler
from app.ws import admin_queue_ws, queue_ws, seats_ws
from app.ws.pubsub import (
    run_admin_queue_pubsub_listener,
    run_queue_pubsub_listener,
    run_seat_pubsub_listener,
)

log = logging.getLogger(__name__)

UPLOAD_DIR = Path("uploads")


@asynccontextmanager
async def lifespan(app: FastAPI):
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    get_redis_pool()
    redis = await get_redis()
    seat_pubsub_task = asyncio.create_task(run_seat_pubsub_listener(redis))
    # Queue pub/sub needs its own Redis connection (separate pubsub state)
    queue_redis = await get_redis()
    queue_pubsub_task = asyncio.create_task(run_queue_pubsub_listener(queue_redis))
    # Admin queue pub/sub — separate connection
    admin_queue_redis = await get_redis()
    admin_queue_pubsub_task = asyncio.create_task(
        run_admin_queue_pubsub_listener(admin_queue_redis)
    )
    start_scheduler()
    try:
        yield
    finally:
        shutdown_scheduler()
        seat_pubsub_task.cancel()
        queue_pubsub_task.cancel()
        admin_queue_pubsub_task.cancel()
        for task in (seat_pubsub_task, queue_pubsub_task, admin_queue_pubsub_task):
            try:
                await task
            except asyncio.CancelledError:
                pass
            except Exception:  # noqa: BLE001
                log.exception("Error shutting down pub/sub listener")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        debug=settings.debug,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Static files for uploads
    app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

    app.include_router(auth_router.router)
    app.include_router(venues_router.router)
    app.include_router(events_router.router)
    app.include_router(zones_router.router)
    app.include_router(seats_router.router)
    app.include_router(bookings_router.router)
    app.include_router(tickets_router.router)
    app.include_router(dashboard_router.router)
    app.include_router(uploads_router.router)
    app.include_router(payments_router.router)
    app.include_router(users_router.router)
    app.include_router(queue_router.router)
    app.include_router(seats_ws.router)
    app.include_router(queue_ws.router)
    app.include_router(admin_queue_ws.router)

    @app.get("/api/health", tags=["health"])
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
