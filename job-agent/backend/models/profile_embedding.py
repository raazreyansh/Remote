from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.models.db import Base


class ProfileEmbedding(Base):
    __tablename__ = "profile_embeddings"

    profile_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    embedding: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(String(50), nullable=False, default="keyword")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
