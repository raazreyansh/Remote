from __future__ import annotations

from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

from backend.config import get_database_url

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATABASE_URL = get_database_url()

ENGINE_OPTIONS: dict[str, object] = {"pool_pre_ping": True}
if DATABASE_URL.startswith("sqlite"):
    ENGINE_OPTIONS["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **ENGINE_OPTIONS)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

JOB_COLUMN_DEFINITIONS = {
    "skills_match_score": "FLOAT NOT NULL DEFAULT 0",
    "semantic_score": "FLOAT NOT NULL DEFAULT 0",
    "final_score": "FLOAT NOT NULL DEFAULT 0",
    "ats_provider": "VARCHAR(50) NOT NULL DEFAULT 'other'",
    "application_type": "VARCHAR(50) NOT NULL DEFAULT 'redirect'",
    "job_embedding": "TEXT NOT NULL DEFAULT ''",
    "embedding_source": "VARCHAR(50) NOT NULL DEFAULT 'keyword'",
}
APPLICATION_COLUMN_DEFINITIONS = {
    "response_received": "INTEGER NOT NULL DEFAULT 0",
    "interview": "INTEGER NOT NULL DEFAULT 0",
}


def _ensure_job_columns() -> None:
    inspector = inspect(engine)
    if "jobs" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("jobs")}
    missing_columns = {
        name: definition for name, definition in JOB_COLUMN_DEFINITIONS.items() if name not in existing_columns
    }
    if not missing_columns:
        return

    with engine.begin() as connection:
        for column_name, definition in missing_columns.items():
            connection.execute(text(f"ALTER TABLE jobs ADD COLUMN {column_name} {definition}"))


def _ensure_application_columns() -> None:
    inspector = inspect(engine)
    if "applications" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("applications")}
    missing_columns = {
        name: definition for name, definition in APPLICATION_COLUMN_DEFINITIONS.items() if name not in existing_columns
    }
    if not missing_columns:
        return

    with engine.begin() as connection:
        for column_name, definition in missing_columns.items():
            connection.execute(text(f"ALTER TABLE applications ADD COLUMN {column_name} {definition}"))


def create_tables() -> None:
    from backend.models.application import Application
    from backend.models.job import Job
    from backend.models.profile_embedding import ProfileEmbedding

    Base.metadata.create_all(bind=engine)
    _ensure_job_columns()
    _ensure_application_columns()
