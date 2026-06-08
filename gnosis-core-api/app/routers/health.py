from fastapi import APIRouter
from app.workers.celery_app import celery

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    # Ping the Celery broker to confirm connectivity
    try:
        celery.control.ping(timeout=1)
        worker_status = "ok"
    except Exception:
        worker_status = "unreachable"

    return {"api": "ok", "worker": worker_status}
