from __future__ import annotations

from backend.models.db import create_tables
from backend.services.job_service import count_jobs
from backend.services.pipeline import run_job_ingestion


def main() -> None:
    create_tables()
    run_job_ingestion()
    print(f"Total jobs in DB: {count_jobs()}")


if __name__ == "__main__":
    main()
