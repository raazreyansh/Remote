from __future__ import annotations

from typing import Any

import requests

GREENHOUSE_TIMEOUT = 20
GREENHOUSE_HEADERS = {"User-Agent": "Mozilla/5.0"}


def _clean_text(value: str | None) -> str:
    return " ".join((value or "").split())


def fetch_greenhouse_jobs(company_slug: str) -> list[dict[str, Any]]:
    url = f"https://boards-api.greenhouse.io/v1/boards/{company_slug}/jobs"
    response = requests.get(url, headers=GREENHOUSE_HEADERS, timeout=GREENHOUSE_TIMEOUT)
    response.raise_for_status()
    payload = response.json()

    results: list[dict[str, Any]] = []
    for job in payload.get("jobs", []):
        location = (job.get("location") or {}).get("name") or "Remote"
        results.append(
            {
                "title": _clean_text(job.get("title")),
                "company": company_slug,
                "location": _clean_text(location),
                "description": _clean_text(job.get("content")),
                "url": job.get("absolute_url"),
                "source": "greenhouse",
                "application_type": "direct",
                "ats_provider": "greenhouse",
            }
        )

    return [job for job in results if job["url"]]
