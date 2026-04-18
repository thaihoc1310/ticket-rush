import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.redis import get_redis, get_redis_pool
from app.routers import auth as auth_router
from app.routers import bookings as bookings_router
from app.routers import dashboard as dashboard_router
from app.routers import events as events_router
from app.routers import seats as seats_router
from app.routers import tickets as tickets_router
from app.routers import venues as venues_router
from app.routers import zones as zones_router
from app.scheduler.setup import shutdown_scheduler, start_scheduler
from app.ws import seats_ws
from app.ws.pubsub import run_seat_pubsub_listener

log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    get_redis_pool()
    redis = await get_redis()
    pubsub_task = asyncio.create_task(run_seat_pubsub_listener(redis))
    start_scheduler()
    try:
        yield
    finally:
        shutdown_scheduler()
        pubsub_task.cancel()
        try:
            await pubsub_task
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

    app.include_router(auth_router.router)
    app.include_router(venues_router.router)
    app.include_router(events_router.router)
    app.include_router(zones_router.router)
    app.include_router(seats_router.router)
    app.include_router(bookings_router.router)
    app.include_router(tickets_router.router)
    app.include_router(dashboard_router.router)
    app.include_router(seats_ws.router)

    @app.get("/api/health", tags=["health"])
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
