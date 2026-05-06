import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.scheduler.queue_grant_job import grant_queue_batch
from app.scheduler.seat_release_job import sweep_expired_seats
from app.scheduler.session_expire_job import expire_queue_sessions

log = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


def start_scheduler() -> None:
    if scheduler.running:
        return
    scheduler.add_job(
        sweep_expired_seats,
        "interval",
        seconds=3,
        id="sweep_expired_seats",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    scheduler.add_job(
        grant_queue_batch,
        "interval",
        seconds=5,
        id="grant_queue_batch",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    scheduler.add_job(
        expire_queue_sessions,
        "interval",
        seconds=5,
        id="expire_queue_sessions",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()
    log.info("APScheduler started")


def shutdown_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
        log.info("APScheduler stopped")
