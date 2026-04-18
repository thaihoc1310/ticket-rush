import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.scheduler.seat_release_job import sweep_expired_seats

log = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


def start_scheduler() -> None:
    if scheduler.running:
        return
    scheduler.add_job(
        sweep_expired_seats,
        "interval",
        seconds=15,
        id="sweep_expired_seats",
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
