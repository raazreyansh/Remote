from __future__ import annotations

from typing import Callable

import requests

from backend.models.db import create_tables
from backend.services.ashby_scraper import fetch_ashby_jobs
from backend.services.greenhouse_scraper import fetch_greenhouse_jobs
from backend.services.job_service import save_jobs
from backend.services.lever_scraper import fetch_lever_jobs

COMPANIES = {
    "lever": ["plaid", "synmax"],
    "greenhouse": ["stripe", "airbnb", "scaleai", "anthropic", "brex", "figma", "discord", "vercel"],
    "ashby": ["openai", "scaleai"],
}


def fetch_all_ats_jobs() -> list[dict[str, str]]:
    jobs: list[dict[str, str]] = []
    errors: list[str] = []

    sources: dict[str, Callable[[str], list[dict[str, str]]]] = {
        "lever": fetch_lever_jobs,
        "greenhouse": fetch_greenhouse_jobs,
        "ashby": fetch_ashby_jobs,
    }

    for provider, slugs in COMPANIES.items():
        fetcher = sources[provider]
        for slug in slugs:
            try:
                jobs.extend(fetcher(slug))
            except requests.RequestException as exc:
                errors.append(f"{provider}:{slug} -> {exc}")
            except Exception as exc:
                errors.append(f"{provider}:{slug} -> {exc}")

    for error in errors:
        print(f"Warning: ATS ingestion issue: {error}")

    return jobs


def main() -> None:
    create_tables()
    jobs = fetch_all_ats_jobs()
    saved = save_jobs(jobs)
    print(f"Fetched {len(jobs)} ATS jobs")
    print(f"Saved {saved} new ATS jobs")


if __name__ == "__main__":
    main()
