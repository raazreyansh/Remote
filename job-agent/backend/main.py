from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import get_frontend_origins
from backend.models.db import create_tables
from backend.routes.applications import router as applications_router
from backend.routes.jobs import router as jobs_router
from backend.services.analytics_service import get_analytics_snapshot


@asynccontextmanager
async def lifespan(_: FastAPI):
    create_tables()
    yield


app = FastAPI(title="job-agent", lifespan=lifespan)
allowed_origins = get_frontend_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=allowed_origins != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(jobs_router)
app.include_router(applications_router)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/analytics")
def analytics() -> dict[str, object]:
    return get_analytics_snapshot()
