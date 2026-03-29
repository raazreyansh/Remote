from __future__ import annotations

from sqlalchemy import func, select

from backend.models.application import Application
from backend.models.db import SessionLocal
from backend.models.job import Job


def get_analytics_snapshot() -> dict[str, float | int]:
    with SessionLocal() as session:
        total_jobs = session.scalar(select(func.count()).select_from(Job)) or 0
        top_jobs_count = session.scalar(select(func.count()).select_from(Job).where(Job.final_score >= 70)) or 0
        applications_sent = (
            session.scalar(
                select(func.count()).select_from(Application).where(Application.status.in_(["applied", "ready_for_submit"]))
            )
            or 0
        )
        positive_statuses = ["interviewing", "interview", "offer", "responded"]
        positive_responses = (
            session.scalar(select(func.count()).select_from(Application).where(Application.status.in_(positive_statuses)))
            or 0
        )

    response_rate = round((positive_responses / applications_sent) * 100, 2) if applications_sent else 0.0
    return {
        "total_jobs": int(total_jobs),
        "top_jobs_count": int(top_jobs_count),
        "applications_sent": int(applications_sent),
        "response_rate": response_rate,
    }
