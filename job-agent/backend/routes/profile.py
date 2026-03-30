from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from backend.models.db import PROJECT_ROOT
from backend.services.matching import update_all_job_scores
from backend.services.pipeline import run_job_ingestion
from backend.services.profile_service import load_profile, save_profile
from backend.services.resume_parser import extract_text_from_pdf, parse_resume_with_ai

router = APIRouter(prefix="/profile", tags=["profile"])


class ProfileUpdatePayload(BaseModel):
    skills: list[str]
    experience: list[dict | str]
    projects: list[dict | str]
    education: list[dict | str]
    roles: list[str]
    preferred_locations: list[str] | None = None


def _save_upload(file: UploadFile) -> Path:
    filename = file.filename or "resume.pdf"
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Resume upload must be a PDF file.")

    output_dir = PROJECT_ROOT / "data"
    output_dir.mkdir(parents=True, exist_ok=True)
    destination = output_dir / "uploaded_resume.pdf"
    destination.write_bytes(file.file.read())
    return destination


@router.get("")
def profile_detail() -> dict[str, object]:
    try:
        profile = load_profile()
    except FileNotFoundError:
        return {"profile": None}

    return {"profile": profile}


@router.patch("")
def update_profile(payload: ProfileUpdatePayload) -> dict[str, object]:
    profile = save_profile(payload.model_dump())
    updated_jobs = update_all_job_scores(profile)
    return {"profile": profile, "updated_jobs": updated_jobs}


@router.post("/upload-resume")
def upload_resume(
    resume: UploadFile = File(...),
    preferred_locations: str | None = Form(default=None),
) -> dict[str, object]:
    resume_path = _save_upload(resume)
    resume_text = extract_text_from_pdf(resume_path)
    profile = parse_resume_with_ai(resume_text)

    if preferred_locations:
        profile["preferred_locations"] = [
            item.strip() for item in preferred_locations.split(",") if item.strip()
        ]
    else:
        profile.setdefault("preferred_locations", ["Remote"])

    saved_profile = save_profile(profile)
    fetched_count, new_jobs = run_job_ingestion(direct_only=False, include_listing_sites=True)
    updated_jobs = update_all_job_scores(saved_profile)

    return {
        "profile": saved_profile,
        "resume_path": str(resume_path),
        "fetched_count": fetched_count,
        "new_jobs": new_jobs,
        "updated_jobs": updated_jobs,
    }
