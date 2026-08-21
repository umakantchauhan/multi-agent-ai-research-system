# ResearchForge — Next.js Frontend

Premium dashboard for the **Multi-Agent AI Research System** (Search → Read → Write → Critic).

> **Zero changes** to the existing Python code (`agents.py`, `tools.py`, `pipeline.py`). Frontend lives in `frontend/` and an optional API wrapper lives in `backend/api.py`.

## Structure
```
frontend/          # Next.js 14 (App Router + Tailwind)
  src/app/page.tsx           # Main dashboard (input, pipeline stepper, report tabs)
  src/app/api/research/route.ts  # Proxy to Python backend + mock fallback
  src/app/layout.tsx
  src/lib/types.ts

backend/api.py     # FastAPI wrapper — imports run_research_pipeline unchanged
```

## Run — Frontend only (demo data)
```bash
cd frontend
npm install
npm run dev
# http://localhost:3000  — shows mock results without Python backend
```

## Run — Full stack (live Gemini + Tavily)
Terminal 1 — backend:
```bash
pip install -r requirements.txt
pip install fastapi uvicorn
python backend/api.py
# http://127.0.0.1:8000  (GET / => health)
```

Terminal 2 — frontend:
```bash
cd frontend
cp .env.local.example .env.local   # optional, defaults to http://127.0.0.1:8000
npm run dev
# http://localhost:3000  — now returns live reports
```

## How it works
`frontend/src/app/api/research/route.ts` `POST {topic}` →
- tries `POST http://127.0.0.1:8000/api/research {topic}`
- on success: returns live `search_results / scraped_content / report / feedback`
- on failure (backend not running): returns polished **mock** with `_mock: true` banner so UI remains usable

UI mirrors `pipeline.py:14-68` — four stages visualized with status: `search → read → write → critic`.

## Features
- Topic input + example chips + recent history (localStorage)
- Animated 4-step pipeline stepper
- Tabs: Report / Search / Scraped / Critic (+ score badge)
- Copy + Download .md for report
- Source URL extraction + critic score card
- Responsive, dark-text-on-light, violet/indigo accents
