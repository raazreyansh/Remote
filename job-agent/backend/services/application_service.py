from __future__ import annotations

from datetime import datetime

from sqlalchemy import select

from backend.models.application import Application
from backend.models.db import SessionLocal


def create_or_update_application(job_id: int, status: str = "pending", applied: bool = False) -> Application:
    with SessionLocal() as session:
        record = session.execute(select(Application).where(Application.job_id == job_id)).scalar_one_or_none()
        if record is None:
            record = Application(job_id=job_id, status=status)
            session.add(record)
        else:
            record.status = status

        if applied:
            record.applied_at = datetime.utcnow()

        session.commit()
        session.refresh(record)
        return record


def update_application_feedback(application_id: int, response_received: bool, interview: bool) -> Application | None:
    with SessionLocal() as session:
        record = session.get(Application, application_id)
        if record is None:
            return None

        record.response_received = response_received
        record.interview = interview
        session.commit()
        session.refresh(record)
        return record
