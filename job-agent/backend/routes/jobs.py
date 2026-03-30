from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from backend.services.dashboard_service import (
    get_job,
    get_ready_to_apply_jobs,
    get_today_plan,
    get_tiered_today_plan,
    get_top_jobs,
    list_jobs,
)
from backend.services.matching import update_all_job_scores
from backend.services.pipeline import run_job_ingestion
from backend.services.profile_service import load_profile

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("/top")
def top_jobs(threshold: float = Query(default=70.0)) -> dict[str, object]:
    return {"items": get_top_jobs(threshold=threshold)}


@router.get("/all")
def all_jobs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    min_score: float | None = Query(default=None),
    source: str | None = Query(default=None),
    direct_only: bool = Query(default=False),
) -> dict[str, object]:
    return list_jobs(page=page, page_size=page_size, min_score=min_score, source=source, direct_only=direct_only)


@router.get("/ready-to-apply")
def ready_to_apply(
    threshold: float = Query(default=70.0),
    source: str | None = Query(default=None),
) -> dict[str, object]:
    return {"items": get_ready_to_apply_jobs(threshold=threshold, ats_provider=source)}


@router.get("/today-plan")
def today_plan(
    threshold: float = Query(default=70.0),
    limit: int = Query(default=10, ge=1, le=50),
) -> dict[str, object]:
    return {"items": get_today_plan(limit=limit, threshold=threshold)}


@router.get("/today-plan-tiered")
def today_plan_tiered(
    limit: int = Query(default=6, ge=1, le=20),
) -> dict[str, object]:
    return get_tiered_today_plan(limit=limit)


@router.post("/refresh")
def refresh_jobs(
    direct_only: bool = Query(default=False),
    include_listing_sites: bool = Query(default=True),
) -> dict[str, object]:
    fetched_count, new_jobs = run_job_ingestion(
        direct_only=direct_only,
        include_listing_sites=include_listing_sites,
    )

    try:
        profile = load_profile()
        rescored_jobs = update_all_job_scores(profile)
    except FileNotFoundError:
        rescored_jobs = 0

    return {
        "fetched_count": fetched_count,
        "new_jobs": new_jobs,
        "rescored_jobs": rescored_jobs,
    }


@router.get("/{job_id}")
def job_detail(job_id: int) -> dict[str, object]:
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job
