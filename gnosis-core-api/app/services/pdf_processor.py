"""
PDF / image → raw text extraction.
Uses PyMuPDF for native text; falls back to pytesseract OCR for scanned pages.
"""
import io
import fitz  # PyMuPDF
import pytesseract
from PIL import Image

# Minimum native-text characters on a page before we try OCR
_OCR_THRESHOLD = 80
# DPI for rasterising pages before OCR
_OCR_DPI = 300


def _page_to_ocr_text(page: fitz.Page) -> str:
    scale = _OCR_DPI / 72
    mat = fitz.Matrix(scale, scale)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    img = Image.open(io.BytesIO(pix.tobytes("png")))
    return pytesseract.image_to_string(img, lang="eng")


def _extract_page_text(page: fitz.Page) -> str:
    text = page.get_text("text").strip()
    if len(text) >= _OCR_THRESHOLD:
        return text
    return _page_to_ocr_text(page)


def pdf_to_pages(file_bytes: bytes) -> list[str]:
    """Return a list of raw text strings, one per PDF page."""
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    pages = [_extract_page_text(page) for page in doc]
    doc.close()
    return pages


def image_to_text(file_bytes: bytes) -> str:
    """OCR a single image (PNG / JPEG / WebP) and return raw text."""
    img = Image.open(io.BytesIO(file_bytes))
    # Convert to RGB so tesseract doesn't choke on RGBA / palette images
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    return pytesseract.image_to_string(img, lang="eng")
