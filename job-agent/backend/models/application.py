from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.models.db import Base


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending")
    applied_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    response_received: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    interview: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
