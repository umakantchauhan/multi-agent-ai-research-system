# Multi-stage Dockerfile for Render / Fly.io / any Docker host
# Backend: FastAPI (port 8000)
FROM python:3.11-slim AS backend

WORKDIR /app

# System deps for lxml, etc.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY agents.py pipeline.py tools.py ./
COPY backend ./backend

ENV PORT=8000
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

# Healthcheck for Render
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD python -c "import httpx; httpx.get('http://127.0.0.1:8000/api/health', timeout=3)" || exit 1

CMD ["sh", "-c", "uvicorn backend.api:app --host 0.0.0.0 --port ${PORT:-8000}"]
