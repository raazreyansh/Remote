from __future__ import annotations

from backend.services.job_scraper import fetch_all_jobs
from backend.services.job_service import save_jobs


def run_job_ingestion(direct_only: bool = False, include_listing_sites: bool = True) -> tuple[int, int]:
    jobs = fetch_all_jobs(direct_only=direct_only, include_listing_sites=include_listing_sites)
    fetched_count = len(jobs)
    new_jobs = save_jobs(jobs)

    print(f"Fetched {fetched_count} jobs")
    print(f"Saved {new_jobs} new jobs")

    return fetched_count, new_jobs
