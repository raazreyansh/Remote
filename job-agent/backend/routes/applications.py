from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.models.db import SessionLocal
from backend.models.job import Job
from backend.services.application_service import create_or_update_application, update_application_feedback
from backend.services.apply_service import apply_to_job
from backend.services.dashboard_service import list_applications
from backend.services.profile_service import load_profile
from backend.services.resume_generator import generate_cover_letter, generate_resume, save_generated_documents

router = APIRouter(prefix="/applications", tags=["applications"])


class ApplicationStatusUpdate(BaseModel):
    status: str


class ApplicationFeedbackPayload(BaseModel):
    response_received: bool
    interview: bool


@router.get("")
def applications(status: str | None = None) -> dict[str, object]:
    return {"items": list_applications(status=status)}


@router.post("/{job_id}/apply")
def trigger_apply(job_id: int) -> dict[str, object]:
    with SessionLocal() as session:
        job = session.get(Job, job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Job not found")

    profile = load_profile()
    resume_text = generate_resume(job, profile)
    cover_letter = generate_cover_letter(job, profile)
    paths = save_generated_documents(job, resume_text, cover_letter)
    create_or_update_application(job_id, status="opened")
    result = apply_to_job(job, paths["resume_path"], cover_letter)
    create_or_update_application(job_id, status=result["status"], applied=result["status"] == "ready_for_submit")
    return {
        "job_id": job_id,
        "resume_path": str(paths["resume_path"]),
        "cover_path": str(paths["cover_path"]),
        "result": result,
    }


@router.patch("/{job_id}")
def update_application(job_id: int, payload: ApplicationStatusUpdate) -> dict[str, object]:
    record = create_or_update_application(
        job_id,
        status=payload.status,
        applied=payload.status in {"applied", "ready_for_submit"},
    )
    return {
        "id": record.id,
        "job_id": record.job_id,
        "status": record.status,
        "applied_at": record.applied_at.isoformat() if record.applied_at else None,
    }


@router.post("/{application_id}/feedback")
def application_feedback(application_id: int, payload: ApplicationFeedbackPayload) -> dict[str, object]:
    record = update_application_feedback(
        application_id,
        response_received=payload.response_received,
        interview=payload.interview,
    )
    if record is None:
        raise HTTPException(status_code=404, detail="Application not found")

    return {
        "id": record.id,
        "job_id": record.job_id,
        "response_received": bool(record.response_received),
        "interview": bool(record.interview),
    }
