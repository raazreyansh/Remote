from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import and_, or_, select

from backend.models.application import Application
from backend.models.db import SessionLocal
from backend.models.job import Job
from backend.services.matching import calculate_match_score
from backend.services.profile_service import load_profile

ROLE_INCLUDE_PATTERNS = (
    "machine learning engineer",
    "ml engineer",
    "ai engineer",
    "applied ai",
    "research engineer",
    "backend engineer",
    "software engineer",
    "data engineer",
)
ROLE_AI_CONTEXT_PATTERNS = ("ml", "machine learning", "ai", "model", "llm", "applied ai", "voice", "nlp", "cv")
ROLE_EXCLUDE_PATTERNS = ("staff", "principal", "lead")


def _serialize_job(job: Job, plan_tier: str | None = None) -> dict[str, Any]:
    age = datetime.utcnow() - job.created_at
    if age <= timedelta(days=1):
        freshness_bucket = "new_today"
    elif age <= timedelta(days=7):
        freshness_bucket = "this_week"
    else:
        freshness_bucket = "older"

    payload = {
        "id": job.id,
        "title": job.title,
        "company": job.company,
        "location": job.location,
        "url": job.url,
        "description": job.description,
        "source": job.source,
        "match_score": job.match_score,
        "skills_match_score": job.skills_match_score,
        "semantic_score": job.semantic_score,
        "final_score": job.final_score,
        "ats_provider": job.ats_provider,
        "application_type": job.application_type,
        "direct_apply": job.application_type == "direct",
        "freshness_bucket": freshness_bucket,
        "created_at": job.created_at.isoformat(),
    }
    if plan_tier:
        payload["plan_tier"] = plan_tier
    return payload


def _attach_fit_breakdown(job_payload: dict[str, Any], job: Job, profile: dict[str, Any] | None) -> dict[str, Any]:
    if profile is None:
        return job_payload

    scores = calculate_match_score(job, profile)
    job_payload["fit_breakdown"] = {
        "skills_score": scores["skills_match_score"],
        "experience_score": scores["experience_score"],
        "role_score": scores["role_score"],
        "location_score": scores["location_score"],
        "semantic_score": scores["semantic_score"],
        "final_score": scores["final_score"],
        "embedding_source": scores["embedding_source"],
        "score_explanation": scores["score_explanation"],
    }
    return job_payload


def _is_target_role(job: Job) -> bool:
    title = job.title.lower()
    description = (job.description or "").lower()
    if any(token in title for token in ROLE_EXCLUDE_PATTERNS):
        return False

    has_target_title = any(token in title for token in ROLE_INCLUDE_PATTERNS)
    has_ai_context = any(token in title or token in description for token in ROLE_AI_CONTEXT_PATTERNS)
    return has_target_title and has_ai_context


def _get_ready_to_apply_job_records(threshold: float = 70.0, semantic_threshold: float = 0.0, ats_provider: str | None = None) -> list[Job]:
    with SessionLocal() as session:
        query = (
            select(Job)
            .outerjoin(Application, Job.id == Application.job_id)
            .where(
                and_(
                    Job.final_score >= threshold,
                    Job.semantic_score >= semantic_threshold,
                    Job.application_type == "direct",
                    or_(Application.id.is_(None), Application.status.not_in(["applied", "ready_for_submit"])),
                )
            )
            .order_by(Job.final_score.desc(), Job.semantic_score.desc(), Job.created_at.desc())
        )
        if ats_provider:
            query = query.where(Job.ats_provider == ats_provider)

        jobs = session.execute(query).scalars().all()

    unique: dict[int, Job] = {}
    for job in jobs:
        if _is_target_role(job):
            unique[job.id] = job
    return list(unique.values())


def _serialize_application(application: Application, job: Job | None) -> dict[str, Any]:
    return {
        "id": application.id,
        "job_id": application.job_id,
        "job_title": job.title if job else None,
        "company": job.company if job else None,
        "status": application.status,
        "applied_at": application.applied_at.isoformat() if application.applied_at else None,
        "response_received": bool(application.response_received),
        "interview": bool(application.interview),
    }


def list_jobs(
    page: int = 1,
    page_size: int = 20,
    min_score: float | None = None,
    source: str | None = None,
    direct_only: bool = False,
) -> dict[str, Any]:
    offset = max(page - 1, 0) * page_size
    with SessionLocal() as session:
        query = select(Job)
        count_query = select(Job)

        if min_score is not None:
            query = query.where(Job.final_score >= min_score)
            count_query = count_query.where(Job.final_score >= min_score)
        if source:
            query = query.where(or_(Job.source == source, Job.ats_provider == source))
            count_query = count_query.where(or_(Job.source == source, Job.ats_provider == source))
        if direct_only:
            query = query.where(Job.application_type == "direct")
            count_query = count_query.where(Job.application_type == "direct")

        total = len(session.execute(count_query).scalars().all())
        jobs = (
            session.execute(query.order_by(Job.final_score.desc(), Job.created_at.desc()).offset(offset).limit(page_size))
            .scalars()
            .all()
        )

    return {"page": page, "page_size": page_size, "total": total, "items": [_serialize_job(job) for job in jobs]}


def get_job(job_id: int) -> dict[str, Any] | None:
    try:
        profile = load_profile()
    except FileNotFoundError:
        profile = None

    with SessionLocal() as session:
        job = session.get(Job, job_id)
        if job is None:
            return None
        return _attach_fit_breakdown(_serialize_job(job), job, profile)


def get_top_jobs(threshold: float = 70.0) -> list[dict[str, Any]]:
    with SessionLocal() as session:
        jobs = (
            session.execute(select(Job).where(Job.final_score >= threshold).order_by(Job.final_score.desc(), Job.created_at.desc()))
            .scalars()
            .all()
        )
    return [_serialize_job(job) for job in jobs]


def get_ready_to_apply_jobs(threshold: float = 70.0, ats_provider: str | None = None) -> list[dict[str, Any]]:
    jobs = _get_ready_to_apply_job_records(threshold=threshold, ats_provider=ats_provider)
    return [_serialize_job(job) for job in jobs]


def get_today_plan(limit: int = 10, threshold: float = 70.0) -> list[dict[str, Any]]:
    tiered = get_tiered_today_plan(limit=limit)
    return tiered["combined"]


def get_tiered_today_plan(limit: int = 10) -> dict[str, list[dict[str, Any]]]:
    high_conviction_records = _get_ready_to_apply_job_records(threshold=75.0, semantic_threshold=40.0)
    strategic_records = _get_ready_to_apply_job_records(threshold=70.0, semantic_threshold=35.0)

    high_conviction_ids = {job.id for job in high_conviction_records}
    strategic_reach_records = [job for job in strategic_records if job.id not in high_conviction_ids]

    high_conviction = [_serialize_job(job, plan_tier="high_conviction") for job in high_conviction_records[:3]]
    strategic_reach = [_serialize_job(job, plan_tier="strategic_reach") for job in strategic_reach_records[:3]]
    combined = (high_conviction + strategic_reach)[:limit]

    return {
        "high_conviction": high_conviction,
        "strategic_reach": strategic_reach,
        "combined": combined,
    }


def list_applications(status: str | None = None) -> list[dict[str, Any]]:
    with SessionLocal() as session:
        query = select(Application, Job).join(Job, Job.id == Application.job_id)
        if status:
            query = query.where(Application.status == status)
        rows = session.execute(query.order_by(Application.id.desc())).all()
    return [_serialize_application(application, job) for application, job in rows]
