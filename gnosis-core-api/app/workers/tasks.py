"""
process_document — the core pipeline task.

Flow:
  1. Download original file from Supabase Storage
  2. Extract text (PDF → PyMuPDF + OCR fallback; image → pytesseract)
  3. Clean + structure → Markdown
  4. Upload .md to Supabase Storage
  5. Update document record: markdown_path, token_count, status="ready"
  6. On any failure: update status="failed"
"""
import logging
import os

from app.workers.celery_app import celery
from app.database import get_supabase
from app.services import storage, pdf_processor, markdown_cleaner

logger = logging.getLogger(__name__)

IMAGE_MIMES = {"image/png", "image/jpeg", "image/webp", "image/jpg"}


@celery.task(
    bind=True,
    name="app.workers.tasks.process_document",
    max_retries=2,
    default_retry_delay=30,
    autoretry_for=(Exception,),
)
def process_document(self, document_id: str, storage_path: str) -> dict:
    supabase = get_supabase()

    try:
        # ── 1. Fetch document metadata ────────────────────────────────────────
        result = supabase.table("documents").select("title").eq("id", document_id).single().execute()
        doc = result.data
        if not doc:
            raise ValueError(f"Document {document_id} not found in DB")

        title = doc.get("title", "Document")

        # ── 2. Download file from Supabase Storage ────────────────────────────
        logger.info("Downloading %s", storage_path)
        file_bytes = storage.download_file(storage_path)

        # ── 3. Determine file type and extract text ───────────────────────────
        ext = os.path.splitext(storage_path)[1].lower()
        is_image = ext in {".png", ".jpg", ".jpeg", ".webp"}

        if is_image:
            raw_text = pdf_processor.image_to_text(file_bytes)
            markdown, token_count = markdown_cleaner.single_text_to_markdown(raw_text, title=title)
            page_count = 1
        else:
            pages = pdf_processor.pdf_to_pages(file_bytes)
            page_count = len(pages)
            markdown, token_count = markdown_cleaner.pages_to_markdown(pages, title=title)

        if not markdown.strip():
            raise ValueError("Extracted content is empty — the file may be blank or unreadable")

        # ── 4. Upload Markdown to Supabase Storage ────────────────────────────
        # Replace the file extension with .md, same path prefix
        md_path = os.path.splitext(storage_path)[0] + ".md"
        logger.info("Uploading markdown to %s (%d tokens)", md_path, token_count)
        storage.upload_markdown(md_path, markdown)

        # ── 5. Update document record ─────────────────────────────────────────
        supabase.table("documents").update({
            "markdown_path": md_path,
            "token_count": token_count,
            "page_count": page_count,
            "status": "ready",
        }).eq("id", document_id).execute()

        logger.info("Document %s processed successfully", document_id)
        return {"document_id": document_id, "status": "ready", "token_count": token_count}

    except Exception as exc:
        logger.error("Pipeline failed for document %s: %s", document_id, exc, exc_info=True)
        # Mark as failed only on final retry exhaustion
        if self.request.retries >= self.max_retries:
            supabase.table("documents").update({"status": "failed"}).eq("id", document_id).execute()
        raise
