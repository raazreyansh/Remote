from __future__ import annotations

from typing import Any

import requests

LEVER_TIMEOUT = 20
LEVER_HEADERS = {"User-Agent": "Mozilla/5.0"}


def _clean_html_text(value: str | None) -> str:
    return " ".join((value or "").split())


def fetch_lever_jobs(company_slug: str) -> list[dict[str, Any]]:
    url = f"https://api.lever.co/v0/postings/{company_slug}?mode=json"
    response = requests.get(url, headers=LEVER_HEADERS, timeout=LEVER_TIMEOUT)
    response.raise_for_status()
    jobs = response.json()

    results: list[dict[str, Any]] = []
    for job in jobs:
        categories = job.get("categories", {}) or {}
        location = categories.get("location") or categories.get("team") or "Remote"
        apply_url = job.get("hostedUrl") or job.get("applyUrl")
        if not apply_url:
            continue

        results.append(
            {
                "title": _clean_html_text(job.get("text")),
                "company": company_slug,
                "location": _clean_html_text(location),
                "description": _clean_html_text(job.get("descriptionPlain") or job.get("description")),
                "url": apply_url,
                "source": "lever",
                "application_type": "direct",
                "ats_provider": "lever",
            }
        )

    return results
