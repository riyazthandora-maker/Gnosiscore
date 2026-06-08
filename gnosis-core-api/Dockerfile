FROM python:3.12-slim

# Tesseract OCR + system deps for PyMuPDF
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

# API server (override with Celery command for worker service)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
