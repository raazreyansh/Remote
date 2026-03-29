# job-agent

FastAPI backend for ATS-first job ingestion, semantic ranking, document generation, and safe semi-automatic applications.

## Local setup

1. Create and activate a virtual environment.
2. Install dependencies:
   `pip install -r requirements.txt`
3. Copy `.env.example` to `.env`.
4. Add `OPENAI_API_KEY`.
5. Keep `DATABASE_URL=sqlite:///jobs.db` for local development or switch to PostgreSQL for deployment.
6. Add `data/profile.json`.

## Run locally

`uvicorn backend.main:app --reload`

## Daily pipeline

`bash run_daily.sh`

This ingests ATS jobs and reruns job scoring against `data/profile.json`.

## Production deployment

### Backend

- Host on Railway or Render.
- Start command:
  `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
- Required environment variables:
  - `DATABASE_URL`
  - `OPENAI_API_KEY`
  - `FRONTEND_ORIGINS`

Example PostgreSQL URL:

`DATABASE_URL=postgresql://user:password@host:5432/dbname`

### Frontend

Point the dashboard to the deployed backend with:

`NEXT_PUBLIC_API_BASE_URL=https://your-backend.up.railway.app`
