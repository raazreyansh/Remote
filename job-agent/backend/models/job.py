from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.models.db import Base


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    company: Mapped[str] = mapped_column(String(255), nullable=False)
    location: Mapped[str] = mapped_column(String(255), nullable=False, default="Remote")
    url: Mapped[str] = mapped_column(String(1024), nullable=False, unique=True, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    source: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    match_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    skills_match_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    semantic_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    final_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    ats_provider: Mapped[str] = mapped_column(String(50), nullable=False, default="other")
    application_type: Mapped[str] = mapped_column(String(50), nullable=False, default="redirect")
    job_embedding: Mapped[str] = mapped_column(Text, nullable=False, default="")
    embedding_source: Mapped[str] = mapped_column(String(50), nullable=False, default="keyword")
