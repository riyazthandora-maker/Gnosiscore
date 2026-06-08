from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from app.config import settings
from app.workers.tasks import process_document

router = APIRouter(prefix="/pipeline", tags=["pipeline"])


def verify_internal_key(x_internal_key: str = Header(...)):
    if x_internal_key != settings.internal_api_key:
        raise HTTPException(status_code=401, detail="Invalid internal API key")


class ProcessRequest(BaseModel):
    document_id: str
    storage_path: str


@router.post("/process", status_code=202)
def trigger_processing(
    body: ProcessRequest,
    _: None = Depends(verify_internal_key),
):
    """
    Enqueue a PDF/image → Markdown conversion task.
    Called by the Next.js API route after a successful file upload.
    Returns immediately; processing happens asynchronously in the Celery worker.
    """
    task = process_document.apply_async(
        args=[body.document_id, body.storage_path],
        queue="pipeline",
    )
    return {"task_id": task.id, "status": "queued"}


@router.get("/status/{task_id}", dependencies=[Depends(verify_internal_key)])
def task_status(task_id: str):
    """Poll the status of a processing task (optional — frontend uses DB polling)."""
    from celery.result import AsyncResult
    result = AsyncResult(task_id, app=process_document.app)
    return {
        "task_id": task_id,
        "state": result.state,
        "info": result.info if result.state not in ("PENDING", "STARTED") else None,
    }
