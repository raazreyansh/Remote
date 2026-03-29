from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(PROJECT_ROOT / ".env")


def _normalize_database_url(value: str) -> str:
    if value.startswith("postgres://"):
        return value.replace("postgres://", "postgresql://", 1)
    return value


def get_database_url() -> str:
    default_sqlite = f"sqlite:///{PROJECT_ROOT / 'jobs.db'}"
    return _normalize_database_url(os.getenv("DATABASE_URL", default_sqlite))


def get_frontend_origins() -> list[str]:
    raw_value = os.getenv("FRONTEND_ORIGINS", "*")
    if raw_value.strip() == "*":
        return ["*"]
    return [origin.strip() for origin in raw_value.split(",") if origin.strip()]
