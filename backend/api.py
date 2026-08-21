"""
FastAPI wrapper for the existing Multi-Agent Research Pipeline.
Does NOT modify agents.py / tools.py / pipeline.py — only imports them.

Run:
  pip install fastapi uvicorn
  python backend/api.py
  # serves at http://127.0.0.1:8000

Frontend (Next.js) proxies /api/research -> this server.
"""

import os
import sys
from pathlib import Path

# Ensure project root is on sys.path so `pipeline`/`agents`/`tools` import
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="ResearchForge Backend", version="1.0.0")

# CORS for Next.js dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ResearchRequest(BaseModel):
    topic: str

@app.get("/")
def health():
    return {"status": "ok", "service": "researchforge-backend", "pipeline": "agents → pipeline"}

@app.get("/api/health")
def health2():
    return {"status": "ok"}

def _is_quota_error(exc: Exception) -> bool:
    """Detect Gemini/Vertex quota & rate-limit errors to surface as 429."""
    msg = str(exc).lower()
    # Covers GoogleRateLimitError, 429, RESOURCE_EXHAUSTED, quota exceeded
    quota_markers = ["429", "resource_exhausted", "quota", "rate limit", "ratelimit", "generativelanguage.googleapis.com/generate_content_free_tier_requests"]
    exc_name = type(exc).__name__.lower()
    if "ratelimit" in exc_name or "quota" in exc_name:
        return True
    return any(m in msg for m in quota_markers)


@app.post("/api/research")
def research(req: ResearchRequest):
    topic = (req.topic or "").strip()
    if len(topic) < 2:
        raise HTTPException(status_code=400, detail="Topic must be at least 2 characters.")

    # Lazy import so env / missing keys show as HTTP errors
    try:
        from pipeline import run_research_pipeline  # type: ignore
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to import pipeline: {e}")

    try:
        state = run_research_pipeline(topic)
    except Exception as e:
        if _is_quota_error(e):
            # Extract retry delay if present, otherwise suggest default
            detail = str(e)
            # Provide actionable message for UI
            friendly = (
                "Gemini API quota exceeded (429 RESOURCE_EXHAUSTED). "
                "Free tier limit is 20 requests/day for gemini-2.5-flash. "
                "Please wait ~30s and retry, or enable billing / use a different API key. "
                f"Details: {detail}"
            )
            raise HTTPException(status_code=429, detail=friendly)
        # surface real error to frontend
        raise HTTPException(status_code=500, detail=f"Pipeline error: {e}")

    # Normalize - pipeline returns dict with keys search_results / scraped_content / report / feedback
    return {
        "search_results": state.get("search_results", ""),
        "scraped_content": state.get("scraped_content", ""),
        "report": state.get("report", ""),
        "feedback": state.get("feedback", ""),
    }

@app.post("/api/research/stream")
def research_stream_placeholder(req: ResearchRequest):
    # Placeholder for SSE extension; for now just return same as /api/research
    return research(req)


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("api:app", host="0.0.0.0", port=port, reload=True)
