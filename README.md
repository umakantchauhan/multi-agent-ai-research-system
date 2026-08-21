# multi-agent-ai-research-system — ResearchForge

Multi-agent research pipeline: **Search (Tavily) → Reader (scrape) → Writer (Gemini 2.5 Flash) → Critic**. FastAPI backend + Next.js 14 frontend.

## Deploy with GitHub Actions → Vercel + Render

### 1. Render (Backend)
1. Push this repo to GitHub (already done).
2. Render Dashboard → New → Blueprint → connect `umakantchauhan/multi-agent-ai-research-system` → `render.yaml` auto-creates `researchforge-backend`.
3. Add env vars in Render: `TAVILY_API_KEY`, `GEMINI_API_KEY` (and optionally `GOOGLE_API_KEY`).
4. Copy Deploy Hook URL: Service → Settings → Deploy Hook.
5. GitHub → Settings → Secrets and variables → Actions → New secret: `RENDER_DEPLOY_HOOK_URL` = hook URL.
6. Every push to `main` touching `backend/**`, `agents.py`, `pipeline.py`, `tools.py`, `requirements.txt` triggers `.github/workflows/deploy-backend-render.yml:1` (hook + Docker verify). If you skip the hook, Render auto-deploys anyway.

Local test: `pip install -r requirements.txt && python backend/api.py` → `http://127.0.0.1:8000/api/health`

### 2. Vercel (Frontend)
1. Vercel → Add New Project → import same GitHub repo → Root Directory = `frontend` → Framework = Next.js.
2. In Vercel Project → Settings → Environment Variables add:
   - `BACKEND_URL` = `https://<your-render-service>.onrender.com` (e.g. `https://researchforge-backend.onrender.com`)
3. Get Vercel secrets: `vercel login` locally, then:
   ```bash
   vercel link  # link to project
   cat .vercel/project.json  # gives orgId + projectId
   vercel tokens create
   ```
4. GitHub → Secrets → add: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
5. Push to `main` touching `frontend/**` triggers `.github/workflows/deploy-frontend-vercel.yml:1` → `vercel build` + `vercel deploy --prod`.

Local test: `cd frontend && npm ci && BACKEND_URL=http://127.0.0.1:8000 npm run dev` → `http://localhost:3000`

### CI (already active)
`.github/workflows/ci.yml:1` runs on every PR/push: backend `py_compile` + frontend `next build`.

### Env vars overview
| Where | Key | Value |
|-------|-----|-------|
| Render | `TAVILY_API_KEY` | from tavily.com |
| Render | `GEMINI_API_KEY` | from aistudio.google.com |
| Vercel | `BACKEND_URL` | Render URL |

See `frontend/.env.local.example` and `render.yaml:1`, `Dockerfile:1`.
