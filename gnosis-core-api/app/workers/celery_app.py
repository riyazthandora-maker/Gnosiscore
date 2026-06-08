from celery import Celery
from app.config import settings

celery = Celery(
    "gnosis-core",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.workers.tasks"],
)

celery.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,           # Re-queue if worker crashes mid-task
    worker_prefetch_multiplier=1,  # One task at a time per worker slot
    task_routes={
        "app.workers.tasks.process_document": {"queue": "pipeline"},
    },
)
