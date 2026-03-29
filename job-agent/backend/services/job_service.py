from __future__ import annotations

from sqlalchemy import select

from backend.models.db import SessionLocal
from backend.models.job import Job
from backend.services.application_classifier import classify_application_type, detect_ats_provider


def save_jobs(jobs_list: list[dict[str, str]]) -> int:
    if not jobs_list:
        return 0

    unique_jobs: list[dict[str, str]] = []
    seen_urls: set[str] = set()
    for job_data in jobs_list:
        url = job_data["url"]
        if url in seen_urls:
            continue
        seen_urls.add(url)
        unique_jobs.append(job_data)

    new_jobs = 0
    with SessionLocal() as session:
        for job_data in unique_jobs:
            ats_provider = job_data.get("ats_provider") or detect_ats_provider(job_data["url"])
            application_type = job_data.get("application_type") or classify_application_type(job_data["url"])
            job_data = {
                **job_data,
                "ats_provider": ats_provider,
                "application_type": application_type,
            }
            existing_job = session.execute(select(Job).where(Job.url == job_data["url"])).scalar_one_or_none()
            if existing_job:
                existing_job.ats_provider = job_data["ats_provider"]
                existing_job.application_type = job_data["application_type"]
                continue

            session.add(Job(**job_data))
            new_jobs += 1

        session.commit()

    return new_jobs


def count_jobs() -> int:
    with SessionLocal() as session:
        return session.query(Job).count()


def get_job_by_url(url: str) -> Job | None:
    with SessionLocal() as session:
        return session.execute(select(Job).where(Job.url == url)).scalar_one_or_none()


def ensure_job(job_data: dict[str, str]) -> Job:
    ats_provider = job_data.get("ats_provider") or detect_ats_provider(job_data["url"])
    application_type = job_data.get("application_type") or classify_application_type(job_data["url"])
    enriched_job = {
        **job_data,
        "ats_provider": ats_provider,
        "application_type": application_type,
    }

    with SessionLocal() as session:
        record = session.execute(select(Job).where(Job.url == enriched_job["url"])).scalar_one_or_none()
        if record is None:
            record = Job(**enriched_job)
            session.add(record)
            session.commit()
            session.refresh(record)
            return record

        for key, value in enriched_job.items():
            setattr(record, key, value)
        session.commit()
        session.refresh(record)
        return record
