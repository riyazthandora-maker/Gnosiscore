"""Supabase Storage helpers used by the pipeline worker."""
from app.database import get_supabase

BUCKET = "documents"


def download_file(storage_path: str) -> bytes:
    supabase = get_supabase()
    response = supabase.storage.from_(BUCKET).download(storage_path)
    return response


def upload_markdown(storage_path: str, content: str) -> str:
    """
    Upload markdown content and return the storage path.
    storage_path example: "<user_id>/<uuid>/content.md"
    """
    supabase = get_supabase()
    data = content.encode("utf-8")
    supabase.storage.from_(BUCKET).upload(
        storage_path,
        data,
        {"content-type": "text/markdown; charset=utf-8", "upsert": "true"},
    )
    return storage_path


def delete_file(storage_path: str) -> None:
    supabase = get_supabase()
    supabase.storage.from_(BUCKET).remove([storage_path])
